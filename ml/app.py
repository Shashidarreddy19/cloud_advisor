from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np
import pandas as pd
import joblib
import os
import json
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

# Load ML model and scaler
MODEL_PATH = "xgboost_vm_model.pkl"
SCALER_PATH = "scaler.pkl"
REGISTRY_PATH = "model_registry.json"

model = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)

# Load model version from registry
model_version = "unknown"
if os.path.exists(REGISTRY_PATH):
    with open(REGISTRY_PATH, 'r') as f:
        registry = json.load(f)
        model_version = registry.get("latest_version", "unknown")
        print(f"Loaded model version: {model_version}")

# Feature order for ML model (12 features - matches trained model)
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
    # Original 12 (required)
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
    
    # New 12 (optional with defaults for backward compatibility)
    cpu_spike_ratio: float = Field(default=1.0, ge=1.0)
    memory_spike_ratio: float = Field(default=1.0, ge=1.0)
    cpu_throttle_percent: float = Field(default=0.0, ge=0, le=100)
    peak_hour_avg_cpu: Optional[float] = Field(default=None, ge=0, le=100)
    off_peak_avg_cpu: Optional[float] = Field(default=None, ge=0, le=100)
    weekend_avg_cpu: Optional[float] = Field(default=None, ge=0, le=100)
    memory_swap_usage: float = Field(default=0.0, ge=0, le=100)
    disk_latency_ms: float = Field(default=10.0, ge=0)
    network_packet_loss: float = Field(default=0.0, ge=0, le=100)
    data_days: int = Field(default=30, ge=1)
    granularity_hourly: int = Field(default=1, ge=0, le=1)
    workload_pattern: int = Field(default=0, ge=0, le=3)

class VMBatchPredictionRequest(BaseModel):
    items: List[VMPredictionRequest]

class CSVBatchItem(BaseModel):
    # Original 12 with defaults
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
    
    # New 12 with defaults
    cpu_spike_ratio: float = Field(default=1.0, ge=1.0)
    memory_spike_ratio: float = Field(default=1.0, ge=1.0)
    cpu_throttle_percent: float = Field(default=0.0, ge=0, le=100)
    peak_hour_avg_cpu: float = Field(default=0.0, ge=0, le=100)
    off_peak_avg_cpu: float = Field(default=0.0, ge=0, le=100)
    weekend_avg_cpu: float = Field(default=0.0, ge=0, le=100)
    memory_swap_usage: float = Field(default=0.0, ge=0, le=100)
    disk_latency_ms: float = Field(default=10.0, ge=0)
    network_packet_loss: float = Field(default=0.0, ge=0, le=100)
    data_days: int = Field(default=30, ge=1)
    granularity_hourly: int = Field(default=1, ge=0, le=1)
    workload_pattern: int = Field(default=0, ge=0, le=3)
    
    # Metadata
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


def apply_feature_defaults(data: dict) -> dict:
    """
    Apply defaults for missing basic features (12-feature model).
    No extra features needed - model only uses 12 features.
    """
    # Just return the data as-is since we only need the 12 basic features
    # The model will use whatever is provided
    return data


def calculate_data_quality_factor(data_days: int = 30) -> tuple:
    """
    Calculate confidence adjustment factor (simplified for 12-feature model).
    Since we don't have data_days in the model, always return high quality.
    """
    return 1.0, "high"


def detect_anomalies(features: dict) -> dict:
    """
    Detect anomalies before ML prediction (simplified for 12-feature model).
    
    Returns:
        {
            "anomaly_flag": str,
            "recommendation_blocked": bool,
            "anomaly_message": str,
            "confidence_cap": float | None
        }
    """
    cpu_avg = features.get('cpu_avg', 0)
    memory_p95 = features.get('memory_p95', 0)
    uptime_hours = features.get('uptime_hours', 0)
    
    # Check for sustained overload
    if cpu_avg > 95:
        return {
            "anomaly_flag": "sustained_overload",
            "recommendation_blocked": True,
            "anomaly_message": "This instance is critically overloaded. Investigate root cause first.",
            "confidence_cap": None
        }
    
    # Check for memory crisis
    if memory_p95 > 95:
        return {
            "anomaly_flag": "memory_crisis",
            "recommendation_blocked": True,
            "anomaly_message": "Severe memory pressure detected. Upsizing recommended immediately.",
            "confidence_cap": None
        }
    
    # Check for zombie candidate
    if cpu_avg < 1 and uptime_hours > 720:
        return {
            "anomaly_flag": "zombie_candidate",
            "recommendation_blocked": False,
            "anomaly_message": "Instance has been idle for 30+ days. Recommended action: Terminate to save cost.",
            "confidence_cap": None,
            "override_recommendation": "TERMINATE"
        }
    
    # No anomalies detected
    return {
        "anomaly_flag": None,
        "recommendation_blocked": False,
        "anomaly_message": None,
        "confidence_cap": None
    }
    if cpu_spike_ratio > 10:
        return {
            "anomaly_flag": "spike_contamination",
            "recommendation_blocked": False,
            "anomaly_message": "Extreme CPU spike detected in data. Recommendation confidence is capped at 60%.",
            "confidence_cap": 0.6
        }
    
    # No anomaly detected
    return {
        "anomaly_flag": "none",
        "recommendation_blocked": False,
        "anomaly_message": None,
        "confidence_cap": None
    }

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
        
        # Apply feature defaults
        data = apply_feature_defaults(data)
        
        # Detect anomalies
        anomaly_result = detect_anomalies(data)
        
        # If zombie candidate, override recommendation
        if anomaly_result.get("override_recommendation") == "TERMINATE":
            return {
                "prediction": 3,  # Use 3 for ZOMBIE even though model doesn't have it
                "confidence": 0.95,
                "recommendation": "ZOMBIE – Consider terminating (low utilization, high uptime)",
                "data_quality": calculate_data_quality_factor(data['data_days'])[1],
                "data_days": data['data_days'],
                "granularity": "hourly" if data['granularity_hourly'] == 1 else "daily",
                "model_version": model_version,
                "anomaly_flag": anomaly_result["anomaly_flag"],
                "recommendation_blocked": anomaly_result["recommendation_blocked"],
                "anomaly_message": anomaly_result["anomaly_message"]
            }
        
        # If recommendation blocked, return error
        if anomaly_result["recommendation_blocked"]:
            return {
                "prediction": -1,
                "confidence": 0.0,
                "recommendation": "BLOCKED",
                "data_quality": calculate_data_quality_factor(data['data_days'])[1],
                "data_days": data['data_days'],
                "granularity": "hourly" if data['granularity_hourly'] == 1 else "daily",
                "model_version": model_version,
                "anomaly_flag": anomaly_result["anomaly_flag"],
                "recommendation_blocked": anomaly_result["recommendation_blocked"],
                "anomaly_message": anomaly_result["anomaly_message"]
            }
        
        # Construct feature vector as DataFrame with proper column names
        feature_dict = {f: data[f] for f in FEATURE_ORDER}
        features_df = pd.DataFrame([feature_dict])[FEATURE_ORDER]
        
        # Apply scaler (now with DataFrame)
        features_scaled = scaler.transform(features_df)
        
        # Run prediction
        prediction = int(model.predict(features_scaled)[0])
        probabilities = model.predict_proba(features_scaled)[0]
        model_confidence = float(max(probabilities))
        
        # Calculate data quality factor
        data_quality_factor, data_quality_label = calculate_data_quality_factor(data['data_days'])
        
        # Adjust confidence
        final_confidence = model_confidence * data_quality_factor
        
        # Apply confidence cap if spike contamination
        if anomaly_result["confidence_cap"] is not None:
            final_confidence = min(final_confidence, anomaly_result["confidence_cap"])
        
        # Round to 3 decimal places
        final_confidence = round(final_confidence, 3)
        
        return {
            "prediction": prediction,
            "confidence": final_confidence,
            "recommendation": map_prediction(prediction),
            "data_quality": data_quality_label,
            "data_days": data['data_days'],
            "granularity": "hourly" if data['granularity_hourly'] == 1 else "daily",
            "model_version": model_version,
            "anomaly_flag": anomaly_result["anomaly_flag"],
            "recommendation_blocked": anomaly_result["recommendation_blocked"],
            "anomaly_message": anomaly_result["anomaly_message"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/vm/batch")
def predict_vm_batch(request: VMBatchPredictionRequest):
    try:
        # Build DataFrame for all rows at once
        rows_data = []
        for item in request.items:
            data = item.dict()
            data = apply_feature_defaults(data)
            rows_data.append({f: data[f] for f in FEATURE_ORDER})
        
        features_df = pd.DataFrame(rows_data)[FEATURE_ORDER]
        features_scaled = scaler.transform(features_df)
        
        preds = model.predict(features_scaled)
        probs = model.predict_proba(features_scaled)
        
        results = []
        for i, item in enumerate(request.items):
            pred = int(preds[i])
            model_confidence = float(max(probs[i]))
            
            data = item.dict()
            data = apply_feature_defaults(data)
            
            # Calculate data quality factor
            data_quality_factor, data_quality_label = calculate_data_quality_factor(data['data_days'])
            final_confidence = round(model_confidence * data_quality_factor, 3)
            
            # Detect anomalies
            anomaly_result = detect_anomalies(data)
            
            results.append({
                "prediction": pred,
                "confidence": final_confidence,
                "recommendation": map_prediction(pred),
                "data_quality": data_quality_label,
                "data_days": data['data_days'],
                "granularity": "hourly" if data['granularity_hourly'] == 1 else "daily",
                "model_version": model_version,
                "anomaly_flag": anomaly_result["anomaly_flag"],
                "recommendation_blocked": anomaly_result["recommendation_blocked"],
                "anomaly_message": anomaly_result["anomaly_message"]
            })
        
        return {"count": len(results), "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/csv/batch")
def predict_csv_batch(request: CSVBatchRequest):
    """
    CSV batch endpoint with PostgreSQL pricing lookup.
    NO MOCK DATA - all data comes from database tables.
    Supports 24 features with backward compatibility.
    """
    try:
        # Check batch size limits
        if len(request.items) > 50000:
            raise HTTPException(
                status_code=413,
                detail="Batch too large. Maximum 50,000 instances per upload. Please split your file and upload in parts."
            )
        
        # Prepare features for ML model as DataFrame
        feature_rows_data = []
        for item in request.items:
            d = item.dict()
            d = apply_feature_defaults(d)
            feature_rows_data.append({f: d[f] for f in FEATURE_ORDER})
        
        features_df = pd.DataFrame(feature_rows_data)[FEATURE_ORDER]
        features_scaled = scaler.transform(features_df)
        
        preds = model.predict(features_scaled)
        probs = model.predict_proba(features_scaled)
        
        # Connect to database
        try:
            conn = get_pg_connection()
        except Exception as e:
            print(f"Database connection failed: {e}")
            conn = None
        
        results = []
        for i, item in enumerate(request.items):
            pred = int(preds[i])
            model_confidence = float(max(probs[i]))
            
            # Get feature data with defaults
            d = item.dict()
            d = apply_feature_defaults(d)
            
            # Calculate data quality factor (always high for 12-feature model)
            data_quality_factor, data_quality_label = calculate_data_quality_factor()
            confidence = round(model_confidence * data_quality_factor, 3)
            
            # Detect anomalies
            anomaly_result = detect_anomalies(d)
            
            # Apply confidence cap if needed
            if anomaly_result["confidence_cap"] is not None:
                confidence = min(confidence, anomaly_result["confidence_cap"])
                confidence = round(confidence, 3)
            
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
                "data_quality": data_quality_label,
                "data_days": d['data_days'],
                "granularity": "hourly" if d['granularity_hourly'] == 1 else "daily",
                "model_version": model_version,
                "anomaly_flag": anomaly_result["anomaly_flag"],
                "anomaly_message": anomaly_result["anomaly_message"]
            })
        
        if conn:
            try:
                conn.close()
            except:
                pass
        
        return {"count": len(results), "results": results}
        
    except HTTPException:
        raise
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
