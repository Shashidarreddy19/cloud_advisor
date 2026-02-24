from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np
import joblib
import os
import psycopg2
import psycopg2.extras
from typing import List, Optional
from dotenv import load_dotenv
import sys
from decimal import Decimal
import datetime as _dt

# Add utils directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'utils'))
from savings_calculator import calculate_savings, format_savings_message

# Load .env at startup
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# Load ML model
MODEL_PATH = "xgboost_vm_model.pkl"
model = joblib.load(MODEL_PATH)

# Feature order for ML model
FEATURE_ORDER = [
    "cpu_avg", "cpu_p95", "memory_avg", "memory_p95",
    "disk_read_iops", "disk_write_iops",
    "network_in_bytes", "network_out_bytes",
    "vcpu_count", "ram_gb", "uptime_hours", "cost_per_month"
]

# FastAPI app
app = FastAPI(title="Cloud VM Optimizer ML Service", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# PostgreSQL config
PG_CONFIG = {
    "host": os.getenv("PG_HOST", "localhost"),
    "port": int(os.getenv("PG_PORT", "5432")),
    "dbname": os.getenv("PG_DB", "cloud_optimizer"),
    "user": os.getenv("PG_USER", "postgres"),
    "password": os.getenv("PG_PASS", ""),
}

def get_pg_connection():
    return psycopg2.connect(**PG_CONFIG, cursor_factory=psycopg2.extras.RealDictCursor)

def decimal_safe(obj):
    """Recursively convert Decimal/datetime to JSON-safe types."""
    if isinstance(obj, dict):
        return {k: decimal_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [decimal_safe(v) for v in obj]
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (_dt.datetime, _dt.date)):
        return obj.isoformat()
    return obj

# Request schemas
class VMPredictionRequest(BaseModel):
    cpu_avg: float = Field(..., ge=0, le=100)
    cpu_p95: float = Field(..., ge=0, le=100)
    memory_avg: float = Field(..., ge=0, le=100)
    memory_p95: float = Field(..., ge=0, le=100)
    disk_read_iops: float = Field(..., ge=0)
    disk_write_iops: float = Field(..., ge=0)
    network_in_bytes: float = Field(..., ge=0)
    network_out_bytes: float = Field(..., ge=0)
    vcpu_count: float = Field(..., ge=0)
    ram_gb: float = Field(..., ge=0)
    uptime_hours: float = Field(..., ge=0)
    cost_per_month: float = Field(..., ge=0)

class VMBatchPredictionRequest(BaseModel):
    items: List[VMPredictionRequest]

class CSVBatchItem(BaseModel):
    cpu_avg: float = Field(default=0, ge=0, le=100)
    cpu_p95: float = Field(default=0, ge=0, le=100)
    memory_avg: float = Field(default=0, ge=0, le=100)
    memory_p95: float = Field(default=0, ge=0, le=100)
    disk_read_iops: float = Field(default=0, ge=0)
    disk_write_iops: float = Field(default=0, ge=0)
    network_in_bytes: float = Field(default=0, ge=0)
    network_out_bytes: float = Field(default=0, ge=0)
    vcpu_count: float = Field(default=2, ge=0)
    ram_gb: float = Field(default=4, ge=0)
    uptime_hours: float = Field(default=720, ge=0)
    cost_per_month: float = Field(default=0, ge=0)
    cloud: str = Field(default="aws")
    region: str = Field(default="us-east-1")
    instance_type: str = Field(default="")

class CSVBatchRequest(BaseModel):
    items: List[CSVBatchItem]

# Prediction mapping
_FINDING = {0: "Optimal", 1: "Oversized", 2: "Undersized"}

def map_prediction(pred: int) -> str:
    return {
        0: "Optimal – VM is properly sized",
        1: "Oversized – Consider downsizing",
        2: "Undersized – Consider upgrading"
    }.get(pred, "Unknown")

# =============================================================================
# DATABASE QUERY FUNCTIONS - NO MOCK DATA
# =============================================================================

def _lookup_instance(conn, cloud: str, instance_type: str, region: str):
    """
    Look up instance specs + price from PostgreSQL.
    Uses proper table joins - NO MOCK DATA.
    
    Tables used:
    - AWS: aws_instance_sizes + aws_pricing
    - Azure: azure_vm_sizes + azure_vm_pricing  
    - GCP: gcp_vm_sizes + gcp_vm_pricing
    """
    if not conn or not instance_type:
        return None
    
    cloud = cloud.lower()
    try:
        if cloud == "aws":
            # Join aws_instance_sizes with aws_pricing
            sql = """
                SELECT 
                    s.cpu,
                    s.memory_gb,
                    s.architecture,
                    COALESCE(p.price_per_hour, 0) AS price_per_hour
                FROM aws_instance_sizes s
                LEFT JOIN aws_pricing p
                    ON LOWER(TRIM(s.instance_type)) = LOWER(TRIM(p.instance_type))
                    AND LOWER(TRIM(s.region)) = LOWER(TRIM(p.region))
                WHERE LOWER(TRIM(s.instance_type)) = LOWER(TRIM(%s))
                  AND LOWER(TRIM(s.region)) = LOWER(TRIM(%s))
                LIMIT 1
            """
        elif cloud == "azure":
            # Join azure_vm_sizes with azure_vm_pricing
            sql = """
                SELECT 
                    s.cpu,
                    s.memory_gb,
                    COALESCE(p.price_per_hour, 0) AS price_per_hour
                FROM azure_vm_sizes s
                LEFT JOIN azure_vm_pricing p
                    ON LOWER(TRIM(s.vm_size)) = LOWER(TRIM(p.vm_size))
                    AND LOWER(TRIM(s.region)) = LOWER(TRIM(p.region))
                WHERE LOWER(TRIM(s.vm_size)) = LOWER(TRIM(%s))
                  AND LOWER(TRIM(s.region)) = LOWER(TRIM(%s))
                  AND (p.is_spot IS NULL OR p.is_spot = false)
                LIMIT 1
            """
        elif cloud == "gcp":
            # Join gcp_vm_sizes with gcp_vm_pricing
            sql = """
                SELECT 
                    s.cpu,
                    s.memory_gb,
                    COALESCE(p.price_per_hour, 0) AS price_per_hour
                FROM gcp_vm_sizes s
                LEFT JOIN gcp_vm_pricing p
                    ON LOWER(TRIM(s.instance_type)) = LOWER(TRIM(p.instance_type))
                    AND LOWER(TRIM(s.region)) = LOWER(TRIM(p.region))
                WHERE LOWER(TRIM(s.instance_type)) = LOWER(TRIM(%s))
                  AND LOWER(TRIM(s.region)) = LOWER(TRIM(%s))
                LIMIT 1
            """
        else:
            return None
            
        with conn.cursor() as cur:
            cur.execute(sql, (instance_type, region))
            row = cur.fetchone()
            
        if row:
            d = dict(row)
            result = {
                "cpu": float(d["cpu"] or 2),
                "memory_gb": float(d["memory_gb"] or 4),
                "price_per_hour": float(d["price_per_hour"]) if d["price_per_hour"] else None
            }
            if cloud == "aws" and "architecture" in d:
                result["architecture"] = d.get("architecture")
            return result
    except Exception as e:
        print(f"Error looking up instance {instance_type}: {e}")
        try:
            conn.rollback()
        except:
            pass
    return None

def _find_cheaper(conn, cloud: str, instance_type: str, region: str,
                  cpu: float, mem: float, price_hr: float, architecture: str = None):
    """
    Find cheaper alternative instance from database.
    Uses proper table joins - NO MOCK DATA.
    """
    if not conn or not price_hr:
        return None
    
    cloud = cloud.lower()
    try:
        if cloud == "aws":
            if architecture:
                sql = """
                    SELECT 
                        s.instance_type,
                        COALESCE(p.price_per_hour, 0) AS price_per_hour
                    FROM aws_instance_sizes s
                    LEFT JOIN aws_pricing p
                        ON LOWER(TRIM(s.instance_type)) = LOWER(TRIM(p.instance_type))
                        AND LOWER(TRIM(s.region)) = LOWER(TRIM(p.region))
                    WHERE LOWER(TRIM(s.region)) = LOWER(TRIM(%s))
                      AND s.cpu <= %s
                      AND s.memory_gb <= %s
                      AND COALESCE(p.price_per_hour, 999) < %s
                      AND LOWER(TRIM(s.instance_type)) != LOWER(TRIM(%s))
                      AND s.architecture = %s
                    ORDER BY COALESCE(p.price_per_hour, 999) ASC
                    LIMIT 1
                """
                params = (region, cpu, mem, price_hr, instance_type, architecture)
            else:
                sql = """
                    SELECT 
                        s.instance_type,
                        COALESCE(p.price_per_hour, 0) AS price_per_hour
                    FROM aws_instance_sizes s
                    LEFT JOIN aws_pricing p
                        ON LOWER(TRIM(s.instance_type)) = LOWER(TRIM(p.instance_type))
                        AND LOWER(TRIM(s.region)) = LOWER(TRIM(p.region))
                    WHERE LOWER(TRIM(s.region)) = LOWER(TRIM(%s))
                      AND s.cpu <= %s
                      AND s.memory_gb <= %s
                      AND COALESCE(p.price_per_hour, 999) < %s
                      AND LOWER(TRIM(s.instance_type)) != LOWER(TRIM(%s))
                    ORDER BY COALESCE(p.price_per_hour, 999) ASC
                    LIMIT 1
                """
                params = (region, cpu, mem, price_hr, instance_type)
                
        elif cloud == "azure":
            sql = """
                SELECT 
                    s.vm_size AS instance_type,
                    COALESCE(p.price_per_hour, 0) AS price_per_hour
                FROM azure_vm_sizes s
                LEFT JOIN azure_vm_pricing p
                    ON LOWER(TRIM(s.vm_size)) = LOWER(TRIM(p.vm_size))
                    AND LOWER(TRIM(s.region)) = LOWER(TRIM(p.region))
                WHERE LOWER(TRIM(s.region)) = LOWER(TRIM(%s))
                  AND s.cpu <= %s
                  AND s.memory_gb <= %s
                  AND COALESCE(p.price_per_hour, 999) < %s
                  AND LOWER(TRIM(s.vm_size)) != LOWER(TRIM(%s))
                  AND (p.is_spot IS NULL OR p.is_spot = false)
                ORDER BY COALESCE(p.price_per_hour, 999) ASC
                LIMIT 1
            """
            params = (region, cpu, mem, price_hr, instance_type)
            
        elif cloud == "gcp":
            sql = """
                SELECT 
                    s.instance_type,
                    COALESCE(p.price_per_hour, 0) AS price_per_hour
                FROM gcp_vm_sizes s
                LEFT JOIN gcp_vm_pricing p
                    ON LOWER(TRIM(s.instance_type)) = LOWER(TRIM(p.instance_type))
                    AND LOWER(TRIM(s.region)) = LOWER(TRIM(p.region))
                WHERE LOWER(TRIM(s.region)) = LOWER(TRIM(%s))
                  AND s.cpu <= %s
                  AND s.memory_gb <= %s
                  AND COALESCE(p.price_per_hour, 999) < %s
                  AND LOWER(TRIM(s.instance_type)) != LOWER(TRIM(%s))
                ORDER BY COALESCE(p.price_per_hour, 999) ASC
                LIMIT 1
            """
            params = (region, cpu, mem, price_hr, instance_type)
        else:
            return None
            
        with conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            
        if row:
            d = dict(row)
            price = float(d["price_per_hour"])
            if price > 0 and price < price_hr:
                return {"instance_type": d["instance_type"], "price_per_hour": price}
    except Exception as e:
        print(f"Error finding cheaper instance: {e}")
        try:
            conn.rollback()
        except:
            pass
    return None

def _find_bigger(conn, cloud: str, instance_type: str, region: str,
                 cpu: float, mem: float, price_hr: float, architecture: str = None):
    """
    Find larger alternative instance from database.
    Uses proper table joins - NO MOCK DATA.
    """
    if not conn:
        return None
    
    cloud = cloud.lower()
    try:
        if cloud == "aws":
            if architecture:
                sql = """
                    SELECT 
                        s.instance_type,
                        COALESCE(p.price_per_hour, 0) AS price_per_hour
                    FROM aws_instance_sizes s
                    LEFT JOIN aws_pricing p
                        ON LOWER(TRIM(s.instance_type)) = LOWER(TRIM(p.instance_type))
                        AND LOWER(TRIM(s.region)) = LOWER(TRIM(p.region))
                    WHERE LOWER(TRIM(s.region)) = LOWER(TRIM(%s))
                      AND (s.cpu > %s OR s.memory_gb > %s)
                      AND COALESCE(p.price_per_hour, 0) > %s
                      AND LOWER(TRIM(s.instance_type)) != LOWER(TRIM(%s))
                      AND s.architecture = %s
                    ORDER BY COALESCE(p.price_per_hour, 999) ASC
                    LIMIT 1
                """
                params = (region, cpu, mem, price_hr, instance_type, architecture)
            else:
                sql = """
                    SELECT 
                        s.instance_type,
                        COALESCE(p.price_per_hour, 0) AS price_per_hour
                    FROM aws_instance_sizes s
                    LEFT JOIN aws_pricing p
                        ON LOWER(TRIM(s.instance_type)) = LOWER(TRIM(p.instance_type))
                        AND LOWER(TRIM(s.region)) = LOWER(TRIM(p.region))
                    WHERE LOWER(TRIM(s.region)) = LOWER(TRIM(%s))
                      AND (s.cpu > %s OR s.memory_gb > %s)
                      AND COALESCE(p.price_per_hour, 0) > %s
                      AND LOWER(TRIM(s.instance_type)) != LOWER(TRIM(%s))
                    ORDER BY COALESCE(p.price_per_hour, 999) ASC
                    LIMIT 1
                """
                params = (region, cpu, mem, price_hr, instance_type)
                
        elif cloud == "azure":
            sql = """
                SELECT 
                    s.vm_size AS instance_type,
                    COALESCE(p.price_per_hour, 0) AS price_per_hour
                FROM azure_vm_sizes s
                LEFT JOIN azure_vm_pricing p
                    ON LOWER(TRIM(s.vm_size)) = LOWER(TRIM(p.vm_size))
                    AND LOWER(TRIM(s.region)) = LOWER(TRIM(p.region))
                WHERE LOWER(TRIM(s.region)) = LOWER(TRIM(%s))
                  AND (s.cpu > %s OR s.memory_gb > %s)
                  AND COALESCE(p.price_per_hour, 0) > %s
                  AND LOWER(TRIM(s.vm_size)) != LOWER(TRIM(%s))
                  AND (p.is_spot IS NULL OR p.is_spot = false)
                ORDER BY COALESCE(p.price_per_hour, 999) ASC
                LIMIT 1
            """
            params = (region, cpu, mem, price_hr, instance_type)
            
        elif cloud == "gcp":
            sql = """
                SELECT 
                    s.instance_type,
                    COALESCE(p.price_per_hour, 0) AS price_per_hour
                FROM gcp_vm_sizes s
                LEFT JOIN gcp_vm_pricing p
                    ON LOWER(TRIM(s.instance_type)) = LOWER(TRIM(p.instance_type))
                    AND LOWER(TRIM(s.region)) = LOWER(TRIM(p.region))
                WHERE LOWER(TRIM(s.region)) = LOWER(TRIM(%s))
                  AND (s.cpu > %s OR s.memory_gb > %s)
                  AND COALESCE(p.price_per_hour, 0) > %s
                  AND LOWER(TRIM(s.instance_type)) != LOWER(TRIM(%s))
                ORDER BY COALESCE(p.price_per_hour, 999) ASC
                LIMIT 1
            """
            params = (region, cpu, mem, price_hr, instance_type)
        else:
            return None
            
        with conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            
        if row:
            d = dict(row)
            price = float(d["price_per_hour"])
            if price > 0:
                return {"instance_type": d["instance_type"], "price_per_hour": price}
    except Exception as e:
        print(f"Error finding bigger instance: {e}")
        try:
            conn.rollback()
        except:
            pass
    return None

# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/health")
def health():
    pg_ok = False
    try:
        conn = get_pg_connection()
        conn.close()
        pg_ok = True
    except Exception:
        pass
    return {
        "status": "ok",
        "model_loaded": True,
        "postgres_connected": pg_ok
    }

@app.post("/predict/vm")
def predict_vm(request: VMPredictionRequest):
    try:
        data = request.dict()
        features = np.array([[data[f] for f in FEATURE_ORDER]])
        
        prediction = int(model.predict(features)[0])
        probabilities = model.predict_proba(features)[0]
        confidence = float(max(probabilities))
        
        return {
            "prediction": prediction,
            "confidence": round(confidence, 3),
            "recommendation": map_prediction(prediction)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/vm/batch")
def predict_vm_batch(request: VMBatchPredictionRequest):
    try:
        rows = []
        for item in request.items:
            data = item.dict()
            rows.append([data[f] for f in FEATURE_ORDER])
        
        features = np.array(rows)
        preds = model.predict(features)
        probs = model.predict_proba(features)
        
        results = []
        for i in range(len(preds)):
            pred = int(preds[i])
            confidence = float(max(probs[i]))
            results.append({
                "prediction": pred,
                "confidence": round(confidence, 3),
                "recommendation": map_prediction(pred)
            })
        
        return {"count": len(results), "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/csv/batch")
def predict_csv_batch(request: CSVBatchRequest):
    """
    CSV batch endpoint with PostgreSQL pricing lookup.
    NO MOCK DATA - all data comes from database tables.
    """
    try:
        # Prepare features for ML model
        feature_rows = []
        for item in request.items:
            d = item.dict()
            feature_rows.append([d[f] for f in FEATURE_ORDER])
        
        features = np.array(feature_rows, dtype=float)
        preds = model.predict(features)
        probs = model.predict_proba(features)
        
        # Connect to database
        try:
            conn = get_pg_connection()
        except Exception as e:
            print(f"Database connection failed: {e}")
            conn = None
        
        results = []
        for i, item in enumerate(request.items):
            pred = int(preds[i])
            confidence = round(float(max(probs[i])), 3)
            finding = _FINDING.get(pred, "Optimal")
            
            cloud = (item.cloud or "aws").lower()
            region = item.region or "us-east-1"
            itype = item.instance_type or ""
            csv_cost = item.cost_per_month
            
            # Look up instance specs and pricing from database
            db_info = _lookup_instance(conn, cloud, itype, region)
            current_cpu = db_info["cpu"] if db_info else (item.vcpu_count or 2)
            current_mem = db_info["memory_gb"] if db_info else (item.ram_gb or 4)
            db_price_hr = db_info["price_per_hour"] if db_info else None
            current_arch = db_info.get("architecture") if db_info else None
            
            # Determine current cost
            if csv_cost > 0:
                current_cost_month = csv_cost
                current_price_hr = db_price_hr if db_price_hr else csv_cost / 730
            elif db_price_hr and db_price_hr > 0:
                current_price_hr = db_price_hr
                current_cost_month = round(db_price_hr * 730, 2)
            else:
                # No pricing data available
                current_price_hr = 0
                current_cost_month = 0
            
            recommended_type = itype
            rec_cost = current_cost_month
            rec_price_hr = current_price_hr
            
            # Find recommendations based on ML prediction
            if finding == "Oversized" and current_price_hr > 0:
                alt = _find_cheaper(conn, cloud, itype, region,
                                    current_cpu, current_mem, current_price_hr, current_arch)
                if alt:
                    recommended_type = alt["instance_type"]
                    rec_price_hr = alt["price_per_hour"]
                    rec_cost = rec_price_hr * 730
                else:
                    recommended_type = None
                    rec_price_hr = None
                    rec_cost = current_cost_month
                    
            elif finding == "Undersized" and current_price_hr > 0:
                alt = _find_bigger(conn, cloud, itype, region,
                                   current_cpu, current_mem, current_price_hr, current_arch)
                if alt:
                    recommended_type = alt["instance_type"]
                    rec_price_hr = alt["price_per_hour"]
                    rec_cost = rec_price_hr * 730
                else:
                    recommended_type = None
                    rec_price_hr = None
                    rec_cost = current_cost_month
            
            optimized_cost_month = round(rec_cost, 2)
            
            # Calculate savings
            savings_data = calculate_savings(current_price_hr, rec_price_hr)
            savings = savings_data["savings_per_month"]
            
            # Build recommendation text
            rec_text = format_savings_message(finding, itype, recommended_type, savings_data)
            
            results.append({
                "prediction": pred,
                "finding": finding,
                "confidence": confidence,
                "recommendedType": recommended_type,
                "currentCostPerMonth": round(current_cost_month, 2),
                "optimizedCostPerMonth": optimized_cost_month,
                "savings": savings,
                "recommendation": rec_text,
            })
        
        if conn:
            try:
                conn.close()
            except:
                pass
        
        return {"count": len(results), "results": results}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/pipeline/run")
def pipeline_run():
    """Trigger the full ML inference pipeline."""
    try:
        from pg_inference_pipeline import run_pipeline
        summary = run_pipeline()
        return decimal_safe({"success": True, **summary})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")

@app.get("/pipeline/predictions")
def pipeline_predictions(
    cloud: Optional[str] = Query(None, description="Filter by cloud: aws | azure | gcp"),
    prediction: Optional[str] = Query(None, description="Filter by prediction: OVERSIZED | UNDERSIZED | OPTIMAL")
):
    """Return all rows from vm_sizing_predictions."""
    try:
        conn = get_pg_connection()
        where_clauses = []
        params = []
        
        if cloud:
            where_clauses.append("LOWER(cloud) = LOWER(%s)")
            params.append(cloud)
        if prediction:
            where_clauses.append("UPPER(prediction) = UPPER(%s)")
            params.append(prediction)
        
        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        sql = f"SELECT * FROM vm_sizing_predictions {where_sql} ORDER BY predicted_at DESC"
        
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        conn.close()
        
        records = decimal_safe([dict(r) for r in rows])
        
        counts = {
            "oversized": sum(1 for r in records if r["prediction"] == "OVERSIZED"),
            "undersized": sum(1 for r in records if r["prediction"] == "UNDERSIZED"),
            "optimal": sum(1 for r in records if r["prediction"] == "OPTIMAL"),
        }
        return {"total": len(records), "counts": counts, "predictions": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
