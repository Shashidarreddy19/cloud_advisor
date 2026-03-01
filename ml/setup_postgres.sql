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
-- Step 4: unknown_instance_types — track unresolvable instance types
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unknown_instance_types (
    id              SERIAL PRIMARY KEY,
    instance_type   VARCHAR(200) NOT NULL,
    cloud           VARCHAR(10)  NOT NULL CHECK (cloud IN ('aws', 'azure', 'gcp')),
    region          VARCHAR(100) NOT NULL,
    detected_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (cloud, instance_type, region)
);

CREATE INDEX IF NOT EXISTS idx_unknown_instance_types_cloud_type 
    ON unknown_instance_types(cloud, instance_type);

-- ---------------------------------------------------------------------------
-- Step 5: Add region availability columns to instance size tables
-- ---------------------------------------------------------------------------
-- Note: These ALTER TABLE statements will only add the column if it doesn't exist
-- The available column defaults to true for existing data

-- AWS instance sizes
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'aws_instance_sizes' AND column_name = 'available'
    ) THEN
        ALTER TABLE aws_instance_sizes ADD COLUMN available BOOLEAN DEFAULT true;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_aws_instance_sizes_type_region_available 
    ON aws_instance_sizes(instance_type, region, available);

-- Azure VM sizes
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'azure_vm_sizes' AND column_name = 'available'
    ) THEN
        ALTER TABLE azure_vm_sizes ADD COLUMN available BOOLEAN DEFAULT true;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_azure_vm_sizes_size_region_available 
    ON azure_vm_sizes(vm_size, region, available);

-- GCP VM sizes
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gcp_vm_sizes' AND column_name = 'available'
    ) THEN
        ALTER TABLE gcp_vm_sizes ADD COLUMN available BOOLEAN DEFAULT true;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gcp_vm_sizes_type_region_available 
    ON gcp_vm_sizes(instance_type, region, available);

-- ---------------------------------------------------------------------------
-- Step 6: Separate GCP region and zone
-- ---------------------------------------------------------------------------
-- Add zone column to gcp_vm_sizes if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gcp_vm_sizes' AND column_name = 'zone'
    ) THEN
        ALTER TABLE gcp_vm_sizes ADD COLUMN zone VARCHAR(100);
    END IF;
END $$;

-- Migrate existing data: extract region from zone if zone contains a dash
-- Example: us-central1-c → region: us-central1, zone: us-central1-c
UPDATE gcp_vm_sizes 
SET zone = region,
    region = SUBSTRING(region FROM '^([^-]+-[^-]+)')
WHERE region LIKE '%-%-%' AND zone IS NULL;

COMMENT ON COLUMN gcp_vm_sizes.region IS 'GCP region (e.g., us-central1)';
COMMENT ON COLUMN gcp_vm_sizes.zone IS 'GCP zone (e.g., us-central1-c)';