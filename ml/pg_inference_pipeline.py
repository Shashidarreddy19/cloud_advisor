"""
pg_inference_pipeline.py
Reads ML feature views from PostgreSQL, runs XGBoost VM model inference,
persists predictions to vm_sizing_predictions table.
"""

import os
import logging
import numpy as np
import pandas as pd
import joblib
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load .env for PG credentials
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

MODEL_PATH    = os.path.join(os.path.dirname(__file__), "xgboost_vm_model.pkl")
MODEL_VERSION = "1.0"

# PostgreSQL connection — reads from env or uses defaults
PG_CONFIG = {
    "host":     os.getenv("PG_HOST",   "localhost"),
    "port":     int(os.getenv("PG_PORT",   "5432")),
    "dbname":   os.getenv("PG_DB",     "cloud_optimizer"),
    "user":     os.getenv("PG_USER",   "postgres"),
    "password": os.getenv("PG_PASS",   ""),
}

# ---------------------------------------------------------------------------
# Feature mapping — ML model expects these columns in this order
# The views expose: avg_cpu_pct, avg_memory_pct, cpu, memory_gb, price_per_hour
# We derive the p95 values as avg * 1.35 (capped at 100) as best-effort
# ---------------------------------------------------------------------------
FEATURE_COLS = [
    "cpu_avg",      # avg_cpu_pct
    "cpu_p95",      # avg_cpu_pct * 1.35
    "memory_avg",   # avg_memory_pct
    "memory_p95",   # avg_memory_pct * 1.35
    "disk_read_iops",
    "disk_write_iops",
    "network_in_bytes",
    "network_out_bytes",
    "vcpu_count",   # cpu
    "ram_gb",       # memory_gb
    "uptime_hours",
    "cost_per_month"  # price_per_hour * 730
]

LABEL_MAP = {0: "OPTIMAL", 1: "OVERSIZED", 2: "UNDERSIZED"}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_connection():
    return psycopg2.connect(**PG_CONFIG)


def load_model():
    log.info(f"Loading VM model from {MODEL_PATH}")
    model = joblib.load(MODEL_PATH)
    log.info("Model loaded OK")
    return model


def read_feature_view(conn, view_name: str) -> pd.DataFrame:
    """Read a cloud-specific ML feature view into a DataFrame."""
    query = f"SELECT * FROM {view_name}"
    try:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
        df = pd.DataFrame(rows, columns=cols)
        # Cast all numeric columns from Decimal to float64 so numpy/XGBoost accept them
        for col in df.columns:
            try:
                df[col] = pd.to_numeric(df[col], errors="ignore")
            except Exception:
                pass
        log.info(f"  {view_name}: {len(df)} rows")
        return df
    except Exception as e:
        log.warning(f"  Could not read {view_name}: {e}")
        conn.rollback()
        return pd.DataFrame()



def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Map view columns to model feature columns."""
    result = pd.DataFrame()
    result["cpu_avg"]          = df["avg_cpu_pct"]
    result["cpu_p95"]          = (df["avg_cpu_pct"] * 1.35).clip(upper=100)
    result["memory_avg"]       = df["avg_memory_pct"]
    result["memory_p95"]       = (df["avg_memory_pct"] * 1.35).clip(upper=100)
    result["disk_read_iops"]   = 500.0   # simulated default (no real CloudWatch yet)
    result["disk_write_iops"]  = 200.0
    result["network_in_bytes"] = 50.0
    result["network_out_bytes"] = 50.0
    result["vcpu_count"]       = df["cpu"].fillna(2)
    result["ram_gb"]           = df["memory_gb"].fillna(4)
    result["uptime_hours"]     = 720
    result["cost_per_month"]   = (df["price_per_hour"].fillna(0.10) * 730).round(4)
    return result[FEATURE_COLS]


def run_inference(model, feature_df: pd.DataFrame):
    """Run model.predict and model.predict_proba; return lists."""
    X = feature_df.values.astype(float)
    preds  = model.predict(X)
    probas = model.predict_proba(X)
    labels       = [LABEL_MAP.get(int(p), "OPTIMAL") for p in preds]
    confidences  = [round(float(max(prob)), 4) for prob in probas]
    return labels, confidences


def upsert_predictions(conn, records: list[dict]):
    """
    Upsert into vm_sizing_predictions.
    records: list of dicts with keys:
        cloud, instance_id, instance_type, region,
        prediction, confidence, model_version, predicted_at
    """
    if not records:
        return

    rows = [
        (
            r["cloud"], r["instance_id"], r["instance_type"],
            r["region"], r["prediction"], r["confidence"],
            r["model_version"], r["predicted_at"]
        )
        for r in records
    ]

    sql = """
        INSERT INTO vm_sizing_predictions
            (cloud, instance_id, instance_type, region, prediction, confidence, model_version, predicted_at)
        VALUES %s
        ON CONFLICT (cloud, instance_id)
        DO UPDATE SET
            instance_type = EXCLUDED.instance_type,
            region        = EXCLUDED.region,
            prediction    = EXCLUDED.prediction,
            confidence    = EXCLUDED.confidence,
            model_version = EXCLUDED.model_version,
            predicted_at  = EXCLUDED.predicted_at
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, rows)
    conn.commit()
    log.info(f"Upserted {len(rows)} predictions")


# ---------------------------------------------------------------------------
# Main pipeline function
# ---------------------------------------------------------------------------

def run_pipeline() -> dict:
    """Execute the full inference pipeline. Returns a summary dict."""
    model = load_model()
    conn  = get_connection()

    all_records = []
    views = ["aws_ml_features", "azure_ml_features", "gcp_ml_features"]

    try:
        for view in views:
            df = read_feature_view(conn, view)
            if df.empty:
                continue

            feature_df = build_features(df)
            labels, confidences = run_inference(model, feature_df)

            now = datetime.now(timezone.utc)
            cloud_records = []
            df_reset = df.reset_index(drop=True)
            for idx, row in df_reset.iterrows():
                cloud_records.append({
                    "cloud":         str(row["cloud"]),
                    "instance_id":   str(row["instance_id"]),
                    "instance_type": str(row["instance_type"]),
                    "region":        str(row["region"]),
                    "prediction":    labels[idx],
                    "confidence":    confidences[idx],
                    "model_version": MODEL_VERSION,
                    "predicted_at":  now
                })

            # Upsert per-cloud immediately to avoid cross-cloud duplicate key issues
            if cloud_records:
                upsert_predictions(conn, cloud_records)
                all_records.extend(cloud_records)

        summary = {
            "total": len(all_records),
            "oversized":  sum(1 for r in all_records if r["prediction"] == "OVERSIZED"),
            "undersized": sum(1 for r in all_records if r["prediction"] == "UNDERSIZED"),
            "optimal":    sum(1 for r in all_records if r["prediction"] == "OPTIMAL"),
            "model_version": MODEL_VERSION,
            "run_at": datetime.now(timezone.utc).isoformat()
        }
        log.info(f"Pipeline done: {summary}")
        return summary

    finally:
        conn.close()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    result = run_pipeline()
    print("\n=== Pipeline Summary ===")
    for k, v in result.items():
        print(f"  {k}: {v}")
