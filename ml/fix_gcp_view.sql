-- =============================================================================
-- Fix GCP VM Costs View
-- This creates a unified view that joins gcp_vm_sizes with gcp_vm_pricing
-- =============================================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS gcp_vm_costs CASCADE;

-- Create gcp_vm_costs view by joining sizes and pricing
CREATE OR REPLACE VIEW gcp_vm_costs AS
SELECT 
    s.instance_type,
    s.region,
    s.cpu,
    s.memory_gb,
    s.architecture,
    s.family,
    COALESCE(p.price_per_hour, 0.10) AS price_per_hour,
    p.currency,
    p.last_updated
FROM gcp_vm_sizes s
LEFT JOIN gcp_vm_pricing p
    ON LOWER(TRIM(s.instance_type)) = LOWER(TRIM(p.instance_type))
    AND LOWER(TRIM(s.region)) = LOWER(TRIM(p.region));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_gcp_vm_costs_lookup 
ON gcp_vm_sizes(instance_type, region);

CREATE INDEX IF NOT EXISTS idx_gcp_vm_pricing_lookup 
ON gcp_vm_pricing(instance_type, region);

-- Verify the view works
SELECT 
    instance_type,
    region,
    cpu,
    memory_gb,
    price_per_hour
FROM gcp_vm_costs
WHERE region LIKE '%central%'
LIMIT 5;

COMMENT ON VIEW gcp_vm_costs IS 'Unified view combining GCP VM specifications and pricing data';
