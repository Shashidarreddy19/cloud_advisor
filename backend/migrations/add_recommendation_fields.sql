-- Migration: Add CPU + Memory Recommendation System Fields
-- Date: 2026-02-28
-- Description: Adds metrics and recommendation fields to resources table

-- Add metrics fields
ALTER TABLE resources 
ADD COLUMN IF NOT EXISTS cpu_avg DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS cpu_p95 DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS memory_avg DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS memory_p95 DECIMAL(5,2);

-- Add metrics metadata fields
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS metrics_status VARCHAR(50) DEFAULT 'missing',
ADD COLUMN IF NOT EXISTS memory_metrics_source VARCHAR(50) DEFAULT 'unavailable',
ADD COLUMN IF NOT EXISTS running_hours_last_14d INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS metrics_window_days INTEGER;

-- Add recommendation fields
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS recommendation VARCHAR(50),
ADD COLUMN IF NOT EXISTS confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS recommendation_warnings TEXT[];

-- Add state tracking field
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS state_checked_at TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_resources_recommendation ON resources(recommendation);
CREATE INDEX IF NOT EXISTS idx_resources_state ON resources(state);
CREATE INDEX IF NOT EXISTS idx_resources_metrics_status ON resources(metrics_status);

-- Add comments for documentation
COMMENT ON COLUMN resources.cpu_avg IS 'Average CPU utilization percentage over metrics window';
COMMENT ON COLUMN resources.cpu_p95 IS '95th percentile CPU utilization percentage';
COMMENT ON COLUMN resources.memory_avg IS 'Average memory utilization percentage over metrics window';
COMMENT ON COLUMN resources.memory_p95 IS '95th percentile memory utilization percentage';
COMMENT ON COLUMN resources.metrics_status IS 'Status of metrics collection: complete, partial, missing, insufficient_data, instance_stopped';
COMMENT ON COLUMN resources.memory_metrics_source IS 'Memory metrics availability: available, agent_required, unavailable';
COMMENT ON COLUMN resources.running_hours_last_14d IS 'Number of hours instance was running in last 14 days';
COMMENT ON COLUMN resources.metrics_window_days IS 'Time window used for metrics collection (7, 14, or 30 days)';
COMMENT ON COLUMN resources.recommendation IS 'Rightsizing recommendation: OVERSIZED, UNDERSIZED, OPTIMAL';
COMMENT ON COLUMN resources.confidence IS 'Confidence score for recommendation (0.0 to 1.0)';
COMMENT ON COLUMN resources.recommendation_warnings IS 'Array of warning messages for recommendation';
COMMENT ON COLUMN resources.state_checked_at IS 'Timestamp when instance state was last checked';
