-- =============================================================================
-- Cloud VM Right-Sizing System — PostgreSQL Setup
-- Run this ONCE against your existing cloud_optimizer database.
-- It adds usage + prediction tables/views WITHOUT touching existing tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: vm_usage — cloud-agnostic usage metrics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vm_usage (
    id              SERIAL PRIMARY KEY,
    cloud           VARCHAR(10)  NOT NULL CHECK (cloud IN ('aws', 'azure', 'gcp')),
    region          VARCHAR(100) NOT NULL,
    instance_id     VARCHAR(200) NOT NULL,
    instance_type   VARCHAR(200) NOT NULL,
    avg_cpu_pct     NUMERIC(5,2) NOT NULL CHECK (avg_cpu_pct BETWEEN 0 AND 100),
    avg_memory_pct  NUMERIC(5,2) NOT NULL CHECK (avg_memory_pct BETWEEN 0 AND 100),
    sample_start    TIMESTAMPTZ  NOT NULL DEFAULT NOW() - INTERVAL '7 days',
    sample_end      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (cloud, instance_id, sample_start)
);

-- ---------------------------------------------------------------------------
-- Step 2: vm_sizing_predictions — persisted ML output
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vm_sizing_predictions (
    id            SERIAL PRIMARY KEY,
    cloud         VARCHAR(10)  NOT NULL,
    instance_id   VARCHAR(200) NOT NULL,
    instance_type VARCHAR(200),
    region        VARCHAR(100),
    prediction    VARCHAR(20)  NOT NULL CHECK (prediction IN ('OVERSIZED', 'UNDERSIZED', 'OPTIMAL')),
    confidence    NUMERIC(5,3) NOT NULL DEFAULT 0,
    model_version VARCHAR(50)  NOT NULL DEFAULT '1.0',
    predicted_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (cloud, instance_id)
);

-- ---------------------------------------------------------------------------
-- Step 3: ML feature views  (join vm_usage with existing *_vm_costs views)
-- Each view produces EXACTLY the feature set expected by the XGBoost model:
--   avg_cpu_pct, avg_memory_pct, cpu (vCPU count), memory_gb, price_per_hour
-- ---------------------------------------------------------------------------

-- AWS
CREATE OR REPLACE VIEW aws_ml_features AS
SELECT
    u.id            AS usage_id,
    u.cloud,
    u.region,
    u.instance_id,
    u.instance_type,
    u.avg_cpu_pct,
    u.avg_memory_pct,
    COALESCE(c.cpu,  2)    AS cpu,
    COALESCE(c.memory_gb, 4) AS memory_gb,
    COALESCE(c.price_per_hour, 0.10) AS price_per_hour,
    u.sample_start,
    u.sample_end
FROM vm_usage u
LEFT JOIN aws_vm_costs c
    ON  LOWER(TRIM(u.instance_type)) = LOWER(TRIM(c.instance_type))
    AND LOWER(TRIM(u.region))        = LOWER(TRIM(c.region))
WHERE u.cloud = 'aws';

-- Azure
CREATE OR REPLACE VIEW azure_ml_features AS
SELECT
    u.id            AS usage_id,
    u.cloud,
    u.region,
    u.instance_id,
    u.instance_type,
    u.avg_cpu_pct,
    u.avg_memory_pct,
    COALESCE(c.cpu,  2)    AS cpu,
    COALESCE(c.memory_gb, 4) AS memory_gb,
    COALESCE(c.price_per_hour, 0.10) AS price_per_hour,
    u.sample_start,
    u.sample_end
FROM vm_usage u
LEFT JOIN azure_vm_costs c
    ON  LOWER(TRIM(u.instance_type)) = LOWER(TRIM(c.vm_size))
    AND LOWER(TRIM(u.region))        = LOWER(TRIM(c.region))
WHERE u.cloud = 'azure';

-- GCP
CREATE OR REPLACE VIEW gcp_ml_features AS
SELECT
    u.id            AS usage_id,
    u.cloud,
    u.region,
    u.instance_id,
    u.instance_type,
    u.avg_cpu_pct,
    u.avg_memory_pct,
    COALESCE(c.cpu,  2)    AS cpu,
    COALESCE(c.memory_gb, 4) AS memory_gb,
    COALESCE(c.price_per_hour, 0.10) AS price_per_hour,
    u.sample_start,
    u.sample_end
FROM vm_usage u
LEFT JOIN gcp_vm_costs c
    ON  LOWER(TRIM(u.instance_type)) = LOWER(TRIM(c.instance_type))
    AND LOWER(TRIM(u.region))        = LOWER(TRIM(c.region))
WHERE u.cloud = 'gcp';

-- ---------------------------------------------------------------------------
-- Step 4: Seed data — realistic vm_usage rows for all 3 clouds
-- ---------------------------------------------------------------------------
INSERT INTO vm_usage (cloud, region, instance_id, instance_type, avg_cpu_pct, avg_memory_pct, sample_start, sample_end)
VALUES
  -- AWS — mix of oversized, undersized, optimal
  ('aws','us-east-1','i-0a1b2c3d4e5f6a001','m5.large',    4.5,  12.3, NOW()-INTERVAL '7d', NOW()),
  ('aws','us-east-1','i-0a1b2c3d4e5f6a002','m5.xlarge',   6.1,  18.0, NOW()-INTERVAL '7d', NOW()),
  ('aws','us-east-1','i-0a1b2c3d4e5f6a003','c5.large',   88.4,  74.2, NOW()-INTERVAL '7d', NOW()),
  ('aws','us-west-2','i-0a1b2c3d4e5f6a004','t3.medium',  52.0,  55.0, NOW()-INTERVAL '7d', NOW()),
  ('aws','us-west-2','i-0a1b2c3d4e5f6a005','r5.large',    3.1,   8.5, NOW()-INTERVAL '7d', NOW()),
  ('aws','eu-west-1','i-0a1b2c3d4e5f6a006','m5.2xlarge',  7.2,  20.1, NOW()-INTERVAL '7d', NOW()),
  ('aws','eu-west-1','i-0a1b2c3d4e5f6a007','c5.xlarge',  91.5,  68.3, NOW()-INTERVAL '7d', NOW()),

  -- Azure
  ('azure','eastus',      '/subscriptions/sub1/vm/vm-prod-001','Standard_D2s_v3', 5.3,  11.0, NOW()-INTERVAL '7d', NOW()),
  ('azure','eastus',      '/subscriptions/sub1/vm/vm-prod-002','Standard_D4s_v3',87.2,  73.6, NOW()-INTERVAL '7d', NOW()),
  ('azure','westeurope',  '/subscriptions/sub1/vm/vm-prod-003','Standard_B2ms',  48.5,  51.2, NOW()-INTERVAL '7d', NOW()),
  ('azure','westeurope',  '/subscriptions/sub1/vm/vm-prod-004','Standard_D8s_v3', 4.1,   9.3, NOW()-INTERVAL '7d', NOW()),
  ('azure','southeastasia','/subscriptions/sub1/vm/vm-prod-005','Standard_E4s_v3',93.1,  88.0, NOW()-INTERVAL '7d', NOW()),

  -- GCP
  ('gcp','us-central1','projects/proj1/zones/us-central1-a/instances/gce-001','n2-standard-2', 5.8,  14.2, NOW()-INTERVAL '7d', NOW()),
  ('gcp','us-central1','projects/proj1/zones/us-central1-a/instances/gce-002','n2-standard-4',85.9,  70.1, NOW()-INTERVAL '7d', NOW()),
  ('gcp','us-east1',   'projects/proj1/zones/us-east1-b/instances/gce-003',   'e2-standard-2',50.2,  49.8, NOW()-INTERVAL '7d', NOW()),
  ('gcp','europe-west1','projects/proj1/zones/europe-west1-b/instances/gce-004','n2-standard-8',3.2,  7.9, NOW()-INTERVAL '7d', NOW()),
  ('gcp','europe-west1','projects/proj1/zones/europe-west1-b/instances/gce-005','n2-highcpu-4',92.3, 65.5, NOW()-INTERVAL '7d', NOW())
ON CONFLICT (cloud, instance_id, sample_start) DO NOTHING;
