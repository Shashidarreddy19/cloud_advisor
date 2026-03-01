"""
Clean VM Optimization Model Training Script
Trains XGBoost classifier with proper regularization to prevent overfitting
"""
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from xgboost import XGBClassifier
import joblib
import json
from datetime import datetime

# Load dataset
print("="*70)
print("VM OPTIMIZATION MODEL TRAINING")
print("="*70)
print("\nLoading dataset...")
df = pd.read_csv('data/vm_optimization_dataset.csv')
print(f"Loaded {len(df)} rows")

# Separate features and labels
FEATURE_COLUMNS = [
    "cpu_avg", "cpu_p95", "memory_avg", "memory_p95",
    "disk_read_iops", "disk_write_iops",
    "network_in_bytes", "network_out_bytes",
    "vcpu_count", "ram_gb", "uptime_hours", "cost_per_month"
]

X = df[FEATURE_COLUMNS]
y = df["label"]

print(f"\nLabel distribution:")
for label, count in y.value_counts().sort_index().items():
    print(f"  Label {label}: {count} ({count/len(y)*100:.1f}%)")

# Train-test split (80-20, stratified)
print("\nSplitting data (80-20)...")
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"Train: {X_train.shape[0]} rows")
print(f"Test: {X_test.shape[0]} rows")

# Scale features
print("\nScaling features...")
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Train XGBoost with regularization
print("\nTraining XGBoost model with regularization...")
model = XGBClassifier(
    objective="multi:softprob",
    num_class=3,
    n_estimators=100,
    max_depth=4,
    learning_rate=0.1,
    min_child_weight=3,
    gamma=0.1,
    reg_alpha=0.1,
    reg_lambda=1.0,
    subsample=0.8,
    colsample_bytree=0.8,
    eval_metric="mlogloss",
    random_state=42,
    tree_method="hist",
    n_jobs=-1
)

model.fit(X_train_scaled, y_train)
print("✅ Training complete")

# Evaluate
print("\nEvaluating model...")
y_pred = model.predict(X_test_scaled)
accuracy = accuracy_score(y_test, y_pred)

print(f"\n{'='*70}")
print(f"RESULTS")
print(f"{'='*70}")
print(f"\nAccuracy: {accuracy*100:.2f}%")

print("\nClassification Report:")
print(classification_report(y_test, y_pred, zero_division=0))

print("Confusion Matrix:")
cm = confusion_matrix(y_test, y_pred)
print(cm)

# Save model artifacts
print(f"\n{'='*70}")
print("SAVING MODEL ARTIFACTS")
print(f"{'='*70}")

# Save model
joblib.dump(model, 'xgboost_vm_model.pkl')
print("✅ Saved: xgboost_vm_model.pkl")

joblib.dump(model, 'xgboost_vm_model_latest.pkl')
print("✅ Saved: xgboost_vm_model_latest.pkl")

# Save scaler
joblib.dump(scaler, 'scaler.pkl')
print("✅ Saved: scaler.pkl")

# Save feature metadata
metadata = {
    "feature_count": len(FEATURE_COLUMNS),
    "feature_names": FEATURE_COLUMNS,
    "trained_at": datetime.now().isoformat(),
    "accuracy": float(accuracy)
}
with open('feature_metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)
print("✅ Saved: feature_metadata.json")

# Save model registry
registry = {
    "latest_version": f"v_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
    "models": [{
        "version": f"v_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        "trained_at": datetime.now().isoformat(),
        "feature_count": len(FEATURE_COLUMNS),
        "overall_accuracy": float(accuracy),
        "status": "active"
    }]
}
with open('model_registry.json', 'w') as f:
    json.dump(registry, f, indent=2)
print("✅ Saved: model_registry.json")

print(f"\n{'='*70}")
print("✅ TRAINING COMPLETE - MODEL READY FOR DEPLOYMENT")
print(f"{'='*70}")
