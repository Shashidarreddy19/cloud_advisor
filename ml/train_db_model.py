import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from xgboost import XGBClassifier

# -------------------------------
# 1. Load dataset
# -------------------------------
DATASET_PATH = r"D:\cloud\ml\data\db_optimization_dataset.csv"

print("Loading database dataset...")
df = pd.read_csv(DATASET_PATH)

# -------------------------------
# 2. Feature selection
# -------------------------------
FEATURE_COLUMNS = [
    "cpu_avg",
    "cpu_p95",
    "memory_avg",
    "memory_p95",
    "db_connections_avg",
    "db_connections_max",
    "connection_util_ratio",
    "read_latency_ms",
    "write_latency_ms",
    "storage_used_gb",
    "storage_allocated_gb",
    "iops_read",
    "iops_write",
    "uptime_hours",
    "cost_per_month"
]

X = df[FEATURE_COLUMNS]
y = df["label"]

# -------------------------------
# 3. Train-test split
# -------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

print("Train size:", X_train.shape)
print("Test size:", X_test.shape)

# -------------------------------
# 4. Model definition
# -------------------------------
model = XGBClassifier(
    objective="multi:softprob",
    num_class=3,
    n_estimators=220,
    max_depth=6,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    eval_metric="mlogloss",
    random_state=42,
    tree_method="hist",
    n_jobs=-1
)

# -------------------------------
# 5. Train
# -------------------------------
print("Training database model...")
model.fit(X_train, y_train)

# -------------------------------
# 6. Evaluate
# -------------------------------
print("Evaluating model...")
y_pred = model.predict(X_test)

accuracy = accuracy_score(y_test, y_pred)
print(f"\n✅ Accuracy: {accuracy * 100:.2f}%\n")

print("Classification Report:")
print(classification_report(y_test, y_pred))

print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# -------------------------------
# 7. Save model
# -------------------------------
MODEL_PATH = "xgboost_db_model.pkl"
joblib.dump(model, MODEL_PATH)

print(f"\n✅ Database model saved as: {MODEL_PATH}")