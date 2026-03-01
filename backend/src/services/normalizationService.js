const logger = require('../utils/logger');

/**
 * Normalization Service
 * Converts ANY input (file upload or cloud API data) into a unified schema
 */

class NormalizationError extends Error {
    constructor(message, field) {
        super(message);
        this.name = 'NormalizationError';
        this.field = field;
    }
}

/**
 * Column mapping variations for CSV files
 */
const COLUMN_MAPPINGS = {
    // Instance identification
    instance_id: ['instance_id', 'instanceid', 'instance-id', 'id', 'vm_id', 'vmid', 'resource_id', 'resourceid'],
    instance_type: ['instance_type', 'instancetype', 'instance-type', 'type', 'vm_size', 'vmsize', 'size', 'machine_type'],

    // Location
    region: ['region', 'location', 'zone', 'availability_zone', 'az'],
    cloud: ['cloud', 'provider', 'cloud_provider'],
    account_id: ['account_id', 'accountid', 'account', 'subscription_id', 'project_id'],

    // OS
    os: ['os', 'operating_system', 'platform', 'os_type'],

    // Timestamp
    timestamp: ['timestamp', 'date', 'datetime', 'time', 'created_at'],

    // CPU metrics
    cpu_avg: ['cpu_avg', 'avg_cpu', 'cpu_average', 'average_cpu', 'cpu%', 'cpu_util', 'cpu_utilization', 'cpuavg', 'cpuutil'],
    cpu_p95: ['cpu_p95', 'p95_cpu', 'cpu_95', '95_cpu', 'cpu_p95_util', 'p95cpu'],

    // Memory metrics
    memory_avg: ['memory_avg', 'avg_memory', 'mem_avg', 'avg_mem', 'memory%', 'mem%', 'memory_util', 'memory_utilization', 'memavg', 'memutil'],
    memory_p95: ['memory_p95', 'p95_memory', 'mem_p95', 'p95_mem', 'memory_95', 'p95memory'],

    // Disk metrics
    disk_read_iops: ['disk_read_iops', 'read_iops', 'disk_read', 'iops_read', 'diskreadiops'],
    disk_write_iops: ['disk_write_iops', 'write_iops', 'disk_write', 'iops_write', 'diskwriteiops'],

    // Network metrics
    network_in_bytes: ['network_in_bytes', 'network_in', 'net_in', 'bytes_in', 'networkin'],
    network_out_bytes: ['network_out_bytes', 'network_out', 'net_out', 'bytes_out', 'networkout'],

    // Instance specs
    vcpu_count: ['vcpu_count', 'vcpu', 'vcpus', 'cpu_count', 'cpus', 'cores', 'cpu'],
    ram_gb: ['ram_gb', 'ram', 'memory_gb', 'memory', 'mem_gb', 'memgb'],

    // Usage
    uptime_hours: ['uptime_hours', 'uptime', 'hours', 'runtime_hours', 'runtime'],

    // Cost
    cost_per_month: ['cost_per_month', 'monthly_cost', 'cost', 'price', 'monthly_price', 'cost_month'],

    // New 12 features for enhanced ML model
    cpu_spike_ratio: ['cpu_spike_ratio', 'cpuspikeratio', 'cpu_spike', 'spike_ratio_cpu'],
    memory_spike_ratio: ['memory_spike_ratio', 'memoryspikeratio', 'memory_spike', 'spike_ratio_memory'],
    cpu_throttle_percent: ['cpu_throttle_percent', 'cputhrottlepercent', 'cpu_throttle', 'throttle_percent'],
    peak_hour_avg_cpu: ['peak_hour_avg_cpu', 'peakhouravgcpu', 'peak_cpu', 'peak_hour_cpu'],
    off_peak_avg_cpu: ['off_peak_avg_cpu', 'offpeakavgcpu', 'offpeak_cpu', 'off_peak_cpu'],
    weekend_avg_cpu: ['weekend_avg_cpu', 'weekendavgcpu', 'weekend_cpu'],
    memory_swap_usage: ['memory_swap_usage', 'memoryswapusage', 'swap_usage', 'swap'],
    disk_latency_ms: ['disk_latency_ms', 'disklatencyms', 'disk_latency', 'latency_ms'],
    network_packet_loss: ['network_packet_loss', 'networkpacketloss', 'packet_loss', 'packetloss'],
    data_days: ['data_days', 'datadays', 'days', 'coverage_days'],
    granularity_hourly: ['granularity_hourly', 'granularityhourly', 'hourly', 'granularity'],
    workload_pattern: ['workload_pattern', 'workloadpattern', 'pattern', 'workload']
};

/**
 * Detect cloud provider from column names or data
 */
function detectCloudType(data, columns = []) {
    const dataStr = JSON.stringify(data).toLowerCase();
    const columnsStr = columns.join(',').toLowerCase();
    const combined = dataStr + columnsStr;

    if (combined.includes('i-') || combined.includes('aws') || combined.includes('ec2')) {
        return 'aws';
    }
    if (combined.includes('azure') || combined.includes('microsoft')) {
        return 'azure';
    }
    if (combined.includes('gcp') || combined.includes('google') || combined.includes('gce')) {
        return 'gcp';
    }

    // Default to AWS if can't detect
    return 'aws';
}

/**
 * Map column name to standard field name
 */
function mapColumnName(columnName) {
    const normalized = columnName.toLowerCase().trim().replace(/[_\s-]+/g, '_');

    for (const [standardName, variations] of Object.entries(COLUMN_MAPPINGS)) {
        if (variations.includes(normalized)) {
            return standardName;
        }
    }

    return null;
}

/**
 * Auto-detect column mappings from CSV headers
 */
function autoDetectColumns(headers) {
    const mappings = {};
    const unmapped = [];

    for (const header of headers) {
        const standardName = mapColumnName(header);
        if (standardName) {
            mappings[header] = standardName;
        } else {
            unmapped.push(header);
        }
    }

    // Log unmapped columns as info (not error) - they will be ignored
    if (unmapped.length > 0) {
        logger.info(`Ignored unknown columns: [${unmapped.join(', ')}]`);
    }

    return { mappings, unmapped };
}

/**
 * Parse and validate a numeric value
 */
function parseNumber(value, fieldName, min = null, max = null) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const num = typeof value === 'number' ? value : parseFloat(value);

    if (isNaN(num)) {
        throw new NormalizationError(
            `Invalid number for ${fieldName}: "${value}"`,
            fieldName
        );
    }

    if (min !== null && num < min) {
        throw new NormalizationError(
            `${fieldName} must be >= ${min}, got ${num}`,
            fieldName
        );
    }

    if (max !== null && num > max) {
        throw new NormalizationError(
            `${fieldName} must be <= ${max}, got ${num}`,
            fieldName
        );
    }

    return num;
}

/**
 * Parse and validate a string value
 */
function parseString(value, fieldName, required = false) {
    if (value === null || value === undefined || value === '') {
        if (required) {
            throw new NormalizationError(
                `${fieldName} is required but was empty`,
                fieldName
            );
        }
        return null;
    }

    return String(value).trim();
}

/**
 * Normalize VM data from file source
 */
function normalizeFromFile(rawData, userMappings = {}) {
    const data = {};

    // Define calculated columns that should NOT be accepted from user input
    const CALCULATED_COLUMNS = [
        'cpu_spike_ratio',
        'memory_spike_ratio',
        'peak_hour_avg_cpu',
        'off_peak_avg_cpu',
        'weekend_avg_cpu',
        'workload_pattern'
    ];

    // Apply user mappings if provided
    if (Object.keys(userMappings).length > 0) {
        for (const [originalCol, standardCol] of Object.entries(userMappings)) {
            if (rawData[originalCol] !== undefined) {
                data[standardCol] = rawData[originalCol];
            }
        }
    } else {
        // Auto-detect mappings
        for (const [key, value] of Object.entries(rawData)) {
            const standardName = mapColumnName(key);
            if (standardName) {
                data[standardName] = value;
            }
        }
    }

    // Check if any calculated columns are present in input
    const detectedCalculatedColumns = CALCULATED_COLUMNS.filter(col =>
        data[col] !== null && data[col] !== undefined && data[col] !== ''
    );

    const calculated_columns_detected = detectedCalculatedColumns.length > 0;

    if (calculated_columns_detected) {
        logger.warn(`Calculated columns detected in input — system values used instead: [${detectedCalculatedColumns.join(', ')}]`);

        // Set calculated columns to null (will be calculated later)
        for (const col of CALCULATED_COLUMNS) {
            data[col] = null;
        }
    }

    // Check for timestamp column
    let hasTimestamp = data.timestamp !== null && data.timestamp !== undefined && data.timestamp !== '';

    // If timestamp exists, validate it's not malformed
    if (hasTimestamp) {
        const timestampStr = String(data.timestamp).trim();
        // Check if it's a valid date format (basic validation)
        // Common formats: YYYY-MM-DD, YYYY-MM-DD HH:MM:SS, MM/DD/YYYY, DD-MM-YYYY, Unix epoch
        const isValidDate = !isNaN(Date.parse(timestampStr)) || !isNaN(Number(timestampStr));
        if (!isValidDate) {
            hasTimestamp = false;
            logger.info(`Malformed timestamp value detected: "${timestampStr}" - treating as missing`);
        }
    }

    const missing_timestamp = !hasTimestamp;

    // Required fields
    const instance_id = parseString(data.instance_id, 'instance_id', true);
    const instance_type = parseString(data.instance_type, 'instance_type', true);
    const region = parseString(data.region, 'region', true);

    // Check if instance_type exists - this will trigger catalog lookup in enrichment
    const has_instance_type = instance_type !== null && instance_type !== undefined && instance_type !== '';

    // Detect cloud if not provided
    const cloud = parseString(data.cloud, 'cloud') || detectCloudType(rawData);

    // Optional fields with defaults
    const account_id = parseString(data.account_id, 'account_id') || 'unknown';
    const os = parseString(data.os, 'os') || 'Linux';

    // Original 12 ML features - with validation
    const cpu_avg = parseNumber(data.cpu_avg, 'cpu_avg', 0, 100) || 0;
    const cpu_p95 = parseNumber(data.cpu_p95, 'cpu_p95', 0, 100) || cpu_avg;
    const memory_avg = parseNumber(data.memory_avg, 'memory_avg', 0, 100) || 0;
    const memory_p95 = parseNumber(data.memory_p95, 'memory_p95', 0, 100) || memory_avg;

    const disk_read_iops = parseNumber(data.disk_read_iops, 'disk_read_iops', 0) || 0;
    const disk_write_iops = parseNumber(data.disk_write_iops, 'disk_write_iops', 0) || 0;
    const network_in_bytes = parseNumber(data.network_in_bytes, 'network_in_bytes', 0) || 0;
    const network_out_bytes = parseNumber(data.network_out_bytes, 'network_out_bytes', 0) || 0;

    // Instance specs - prioritize catalog lookup over CSV values
    // If instance_type exists, set flag for enrichment service to query catalog
    // Store CSV values separately as fallback if catalog lookup fails
    let vcpu_count, ram_gb, csv_vcpu_count, csv_ram_gb;
    if (has_instance_type) {
        // Store CSV values as fallback (if provided)
        csv_vcpu_count = parseNumber(data.vcpu_count, 'vcpu_count', 0) || null;
        csv_ram_gb = parseNumber(data.ram_gb, 'ram_gb', 0) || null;

        // Set to null - enrichment service will fetch from catalog first
        vcpu_count = null;
        ram_gb = null;
    } else {
        // No instance_type - use CSV values or defaults
        vcpu_count = parseNumber(data.vcpu_count, 'vcpu_count', 0) || 2;
        ram_gb = parseNumber(data.ram_gb, 'ram_gb', 0) || 4;
        csv_vcpu_count = null;
        csv_ram_gb = null;
    }

    const uptime_hours = parseNumber(data.uptime_hours, 'uptime_hours', 0) || 720;
    const cost_per_month = parseNumber(data.cost_per_month, 'cost_per_month', 0) || 0;

    // New 12 features for enhanced ML model (optional with defaults)
    // Note: Calculated columns are set to null if user-provided (will be calculated later)
    const cpu_spike_ratio = data.cpu_spike_ratio === null ? null : (parseNumber(data.cpu_spike_ratio, 'cpu_spike_ratio', 1.0) ?? 1.0);
    const memory_spike_ratio = data.memory_spike_ratio === null ? null : (parseNumber(data.memory_spike_ratio, 'memory_spike_ratio', 1.0) ?? 1.0);
    const cpu_throttle_percent = parseNumber(data.cpu_throttle_percent, 'cpu_throttle_percent', 0, 100) ?? 0.0;
    const peak_hour_avg_cpu = data.peak_hour_avg_cpu === null ? null : (parseNumber(data.peak_hour_avg_cpu, 'peak_hour_avg_cpu', 0, 100) ?? cpu_avg);
    const off_peak_avg_cpu = data.off_peak_avg_cpu === null ? null : (parseNumber(data.off_peak_avg_cpu, 'off_peak_avg_cpu', 0, 100) ?? cpu_avg);
    const weekend_avg_cpu = data.weekend_avg_cpu === null ? null : (parseNumber(data.weekend_avg_cpu, 'weekend_avg_cpu', 0, 100) ?? cpu_avg);
    const memory_swap_usage = parseNumber(data.memory_swap_usage, 'memory_swap_usage', 0, 100) ?? 0.0;
    const disk_latency_ms = parseNumber(data.disk_latency_ms, 'disk_latency_ms', 0) ?? 10.0;
    const network_packet_loss = parseNumber(data.network_packet_loss, 'network_packet_loss', 0, 100) ?? 0.0;

    // Temporal metrics - handle missing timestamp
    let data_days, granularity_hourly, workload_pattern, date_source, timestamp_status, confidence_cap, timestamp;

    if (missing_timestamp) {
        // Set defaults when timestamp is missing
        data_days = parseNumber(data.data_days, 'data_days', 1) ?? 30;
        granularity_hourly = 1;
        workload_pattern = 0;
        date_source = 'user_provided';
        timestamp_status = 'missing';
        confidence_cap = 0.70;
        timestamp = null;

        logger.info('Timestamp column missing in CSV upload - will prompt user for time range');
    } else {
        // Use provided values or defaults when timestamp exists
        data_days = parseNumber(data.data_days, 'data_days', 1) ?? 30;
        granularity_hourly = parseNumber(data.granularity_hourly, 'granularity_hourly', 0, 1) ?? 1;
        // workload_pattern is a calculated column - set to null if user-provided
        workload_pattern = data.workload_pattern === null ? null : (parseNumber(data.workload_pattern, 'workload_pattern', 0, 3) ?? 0);
        date_source = 'csv';
        timestamp_status = 'present';
        confidence_cap = null;
        timestamp = parseString(data.timestamp, 'timestamp');
    }

    return {
        cloud,
        account_id,
        region,
        instance_id,
        instance_type,
        os,
        timestamp,

        // Original 12 features
        cpu_avg,
        cpu_p95,
        memory_avg,
        memory_p95,
        disk_read_iops,
        disk_write_iops,
        network_in_bytes,
        network_out_bytes,
        vcpu_count,
        ram_gb,
        uptime_hours,
        cost_per_month,

        // CSV fallback values (for catalog lookup)
        csv_vcpu_count,
        csv_ram_gb,

        // New 12 features
        cpu_spike_ratio,
        memory_spike_ratio,
        cpu_throttle_percent,
        peak_hour_avg_cpu,
        off_peak_avg_cpu,
        weekend_avg_cpu,
        memory_swap_usage,
        disk_latency_ms,
        network_packet_loss,
        data_days,
        granularity_hourly,
        workload_pattern,

        // Timestamp metadata
        missing_timestamp,
        date_source,
        timestamp_status,
        confidence_cap,

        // Calculated columns metadata
        calculated_columns_detected,

        // Catalog priority flag
        has_instance_type,

        source: 'file'
    };
}

/**
 * Normalize VM data from cloud API source
 */
function normalizeFromCloud(rawData, cloud) {
    try {
        // Cloud-specific normalization
        if (cloud === 'aws') {
            return normalizeAWS(rawData);
        } else if (cloud === 'gcp') {
            return normalizeGCP(rawData);
        } else if (cloud === 'azure') {
            return normalizeAzure(rawData);
        } else {
            throw new NormalizationError(`Unsupported cloud provider: ${cloud}`, 'cloud');
        }
    } catch (error) {
        if (error instanceof NormalizationError) {
            throw error;
        }
        throw new NormalizationError(
            `Failed to normalize ${cloud} data: ${error.message}`,
            'cloud_data'
        );
    }
}

/**
 * Normalize AWS EC2 instance data
 * ENHANCED: Includes running_hours_last_14d, memory_metrics_source, missing_metrics, burstable, architecture
 * CRITICAL: Preserve null for missing metrics (don't convert to 0)
 */
function normalizeAWS(rawData) {
    // Determine metrics status based on what's available
    let metrics_status = 'complete';
    const missing_metrics = [];

    // Check CPU metrics (required)
    if (rawData.cpu_avg === null || rawData.cpu_avg === undefined) {
        missing_metrics.push('cpu_avg');
    }
    if (rawData.cpu_p95 === null || rawData.cpu_p95 === undefined) {
        missing_metrics.push('cpu_p95');
    }

    // Check memory metrics (optional but important)
    if (rawData.memory_avg === null || rawData.memory_avg === undefined) {
        missing_metrics.push('memory_avg');
    }
    if (rawData.memory_p95 === null || rawData.memory_p95 === undefined) {
        missing_metrics.push('memory_p95');
    }

    // Set metrics_status based on what's missing
    if (missing_metrics.includes('cpu_avg') || missing_metrics.includes('cpu_p95')) {
        metrics_status = 'missing';
    } else if (missing_metrics.length > 0) {
        metrics_status = 'partial';
    }

    return {
        cloud: 'aws',
        account_id: parseString(rawData.account_id, 'account_id') || 'unknown',
        region: parseString(rawData.region, 'region', true),
        instance_id: parseString(rawData.instance_id, 'instance_id', true),
        instance_type: parseString(rawData.instance_type, 'instance_type', true),
        os: parseString(rawData.os, 'os') || 'unknown',
        os_source: parseString(rawData.os_source, 'os_source') || 'unresolved',
        os_confidence: parseString(rawData.os_confidence, 'os_confidence') || 'low',

        // Instance specs
        vcpu_count: parseNumber(rawData.vcpu_count, 'vcpu_count', 0) ?? null,
        ram_gb: parseNumber(rawData.ram_gb, 'ram_gb', 0) ?? null,
        architecture: parseString(rawData.architecture, 'architecture') ?? null,
        burstable: rawData.burstable === true,
        gpu: rawData.gpu === true,

        // Metrics from CloudWatch - PRESERVE NULL (use ?? instead of ||)
        cpu_avg: parseNumber(rawData.cpu_avg, 'cpu_avg', 0, 100) ?? null,
        cpu_p95: parseNumber(rawData.cpu_p95, 'cpu_p95', 0, 100) ?? null,
        memory_avg: parseNumber(rawData.memory_avg, 'memory_avg', 0, 100) ?? null,
        memory_p95: parseNumber(rawData.memory_p95, 'memory_p95', 0, 100) ?? null,
        cpu_credit_balance: parseNumber(rawData.cpu_credit_balance, 'cpu_credit_balance', 0) ?? null,
        disk_read_iops: parseNumber(rawData.disk_read_iops, 'disk_read_iops', 0) ?? 0,
        disk_write_iops: parseNumber(rawData.disk_write_iops, 'disk_write_iops', 0) ?? 0,
        network_in_bytes: parseNumber(rawData.network_in_bytes ?? rawData.network_in, 'network_in_bytes', 0) ?? 0,
        network_out_bytes: parseNumber(rawData.network_out_bytes ?? rawData.network_out, 'network_out_bytes', 0) ?? 0,

        // Metrics status
        metrics_status: rawData.metrics_status ?? metrics_status,
        memory_metrics_source: parseString(rawData.memory_metrics_source, 'memory_metrics_source') ?? 'unavailable',
        missing_metrics: Array.isArray(rawData.missing_metrics) ? rawData.missing_metrics : missing_metrics,

        // Running hours and metrics window
        running_hours_last_14d: parseNumber(rawData.running_hours_last_14d, 'running_hours_last_14d', 0) ?? 0,
        metrics_window_days: parseNumber(rawData.metrics_window_days, 'metrics_window_days', 0) ?? (parseInt(process.env.METRICS_WINDOW_DAYS) || 30),

        // Cost
        cost_per_month: parseNumber(rawData.cost_per_month, 'cost_per_month', 0) ?? 0,

        source: 'cloud'
    };
}


/**
 * Normalize GCP Compute Engine instance data
 * ENHANCED: Includes running_hours_last_14d, memory_metrics_source, missing_metrics, region/zone separation
 * CRITICAL: Preserve null for missing metrics (don't convert to 0)
 */
function normalizeGCP(rawData) {
    // Determine metrics status based on what's available
    let metrics_status = 'complete';
    const missing_metrics = [];

    // Check CPU metrics (required)
    if (rawData.cpu_avg === null || rawData.cpu_avg === undefined) {
        missing_metrics.push('cpu_avg');
    }
    if (rawData.cpu_p95 === null || rawData.cpu_p95 === undefined) {
        missing_metrics.push('cpu_p95');
    }

    // Check memory metrics (optional but important)
    if (rawData.memory_avg === null || rawData.memory_avg === undefined) {
        missing_metrics.push('memory_avg');
    }
    if (rawData.memory_p95 === null || rawData.memory_p95 === undefined) {
        missing_metrics.push('memory_p95');
    }

    // Set metrics_status based on what's missing
    if (missing_metrics.includes('cpu_avg') || missing_metrics.includes('cpu_p95')) {
        metrics_status = 'missing';
    } else if (missing_metrics.length > 0) {
        metrics_status = 'partial';
    }

    return {
        cloud: 'gcp',
        account_id: parseString(rawData.project_id, 'account_id') || 'unknown',
        region: parseString(rawData.region, 'region', true), // Separate region field
        zone: parseString(rawData.zone, 'zone') ?? null, // Separate zone field
        instance_id: parseString(rawData.instance_id, 'instance_id', true),
        instance_type: parseString(rawData.instance_type ?? rawData.machine_type, 'instance_type', true),
        os: parseString(rawData.os, 'os') || 'unknown',
        os_source: parseString(rawData.os_source, 'os_source') || 'unresolved',
        os_confidence: parseString(rawData.os_confidence, 'os_confidence') || 'low',

        // Instance specs
        vcpu_count: parseNumber(rawData.vcpu_count, 'vcpu_count', 0) ?? null,
        ram_gb: parseNumber(rawData.ram_gb, 'ram_gb', 0) ?? null,
        architecture: parseString(rawData.architecture, 'architecture') ?? null,

        // Metrics from Cloud Monitoring - PRESERVE NULL (use ?? instead of ||)
        cpu_avg: parseNumber(rawData.cpu_avg, 'cpu_avg', 0, 100) ?? null,
        cpu_p95: parseNumber(rawData.cpu_p95, 'cpu_p95', 0, 100) ?? null,
        memory_avg: parseNumber(rawData.memory_avg, 'memory_avg', 0, 100) ?? null,
        memory_p95: parseNumber(rawData.memory_p95, 'memory_p95', 0, 100) ?? null,
        disk_read_iops: parseNumber(rawData.disk_read_iops, 'disk_read_iops', 0) ?? 0,
        disk_write_iops: parseNumber(rawData.disk_write_iops, 'disk_write_iops', 0) ?? 0,
        network_in_bytes: parseNumber(rawData.network_in_bytes ?? rawData.network_in, 'network_in_bytes', 0) ?? 0,
        network_out_bytes: parseNumber(rawData.network_out_bytes ?? rawData.network_out, 'network_out_bytes', 0) ?? 0,

        // Metrics status
        metrics_status: rawData.metrics_status ?? metrics_status,
        memory_metrics_source: parseString(rawData.memory_metrics_source, 'memory_metrics_source') ?? 'unavailable',
        missing_metrics: Array.isArray(rawData.missing_metrics) ? rawData.missing_metrics : missing_metrics,

        // Running hours and metrics window
        running_hours_last_14d: parseNumber(rawData.running_hours_last_14d, 'running_hours_last_14d', 0) ?? 0,
        metrics_window_days: parseNumber(rawData.metrics_window_days, 'metrics_window_days', 0) ?? (parseInt(process.env.METRICS_WINDOW_DAYS) || 30),

        // Cost
        cost_per_month: parseNumber(rawData.cost_per_month, 'cost_per_month', 0) ?? 0,

        source: 'cloud'
    };
}

/**
 * Normalize Azure VM data
 * ENHANCED: Includes running_hours_last_14d, memory_metrics_source, missing_metrics
 * CRITICAL: Preserve null for missing metrics (don't convert to 0)
 */
function normalizeAzure(rawData) {
    // Determine metrics status based on what's available
    let metrics_status = 'complete';
    const missing_metrics = [];

    // Check CPU metrics (required)
    if (rawData.cpu_avg === null || rawData.cpu_avg === undefined) {
        missing_metrics.push('cpu_avg');
    }
    if (rawData.cpu_p95 === null || rawData.cpu_p95 === undefined) {
        missing_metrics.push('cpu_p95');
    }

    // Check memory metrics (optional but important)
    if (rawData.memory_avg === null || rawData.memory_avg === undefined) {
        missing_metrics.push('memory_avg');
    }
    if (rawData.memory_p95 === null || rawData.memory_p95 === undefined) {
        missing_metrics.push('memory_p95');
    }

    // Set metrics_status based on what's missing
    if (missing_metrics.includes('cpu_avg') || missing_metrics.includes('cpu_p95')) {
        metrics_status = 'missing';
    } else if (missing_metrics.length > 0) {
        metrics_status = 'partial';
    }

    return {
        cloud: 'azure',
        account_id: parseString(rawData.subscription_id ?? rawData.account_id, 'account_id') || 'unknown',
        region: parseString(rawData.region ?? rawData.location, 'region', true),
        instance_id: parseString(rawData.instance_id ?? rawData.vm_id, 'instance_id', true),
        instance_type: parseString(rawData.instance_type ?? rawData.vm_size, 'instance_type', true),
        os: parseString(rawData.os ?? rawData.os_type, 'os') || 'unknown',
        os_source: parseString(rawData.os_source, 'os_source') || 'unresolved',
        os_confidence: parseString(rawData.os_confidence, 'os_confidence') || 'low',

        // Instance specs
        vcpu_count: parseNumber(rawData.vcpu_count, 'vcpu_count', 0) ?? null,
        ram_gb: parseNumber(rawData.ram_gb, 'ram_gb', 0) ?? null,
        architecture: parseString(rawData.architecture, 'architecture') ?? null,

        // Metrics from Azure Monitor - PRESERVE NULL (use ?? instead of ||)
        cpu_avg: parseNumber(rawData.cpu_avg, 'cpu_avg', 0, 100) ?? null,
        cpu_p95: parseNumber(rawData.cpu_p95, 'cpu_p95', 0, 100) ?? null,
        memory_avg: parseNumber(rawData.memory_avg, 'memory_avg', 0, 100) ?? null,
        memory_p95: parseNumber(rawData.memory_p95, 'memory_p95', 0, 100) ?? null,
        disk_read_iops: parseNumber(rawData.disk_read_iops, 'disk_read_iops', 0) ?? 0,
        disk_write_iops: parseNumber(rawData.disk_write_iops, 'disk_write_iops', 0) ?? 0,
        network_in_bytes: parseNumber(rawData.network_in_bytes ?? rawData.network_in, 'network_in_bytes', 0) ?? 0,
        network_out_bytes: parseNumber(rawData.network_out_bytes ?? rawData.network_out, 'network_out_bytes', 0) ?? 0,

        // Metrics status
        metrics_status: rawData.metrics_status ?? metrics_status,
        memory_metrics_source: parseString(rawData.memory_metrics_source, 'memory_metrics_source') ?? 'unavailable',
        missing_metrics: Array.isArray(rawData.missing_metrics) ? rawData.missing_metrics : missing_metrics,

        // Running hours and metrics window
        running_hours_last_14d: parseNumber(rawData.running_hours_last_14d, 'running_hours_last_14d', 0) ?? 0,
        metrics_window_days: parseNumber(rawData.metrics_window_days, 'metrics_window_days', 0) ?? (parseInt(process.env.METRICS_WINDOW_DAYS) || 30),

        // Cost
        cost_per_month: parseNumber(rawData.cost_per_month, 'cost_per_month', 0) ?? 0,

        source: 'cloud'
    };
}


/**
 * Main normalization function
 * @param {Object} rawData - Raw VM data
 * @param {String} source - 'file' or 'cloud'
 * @param {Object} options - Additional options (userMappings, cloud)
 * @returns {Object} Normalized VM data
 */
function normalizeVM(rawData, source, options = {}) {
    try {
        if (source === 'file') {
            return normalizeFromFile(rawData, options.userMappings);
        } else if (source === 'cloud') {
            if (!options.cloud) {
                throw new NormalizationError('Cloud provider must be specified for cloud source', 'cloud');
            }
            return normalizeFromCloud(rawData, options.cloud);
        } else {
            throw new NormalizationError(`Invalid source: ${source}. Must be 'file' or 'cloud'`, 'source');
        }
    } catch (error) {
        if (error instanceof NormalizationError) {
            logger.warn(`Normalization failed: ${error.message}`, { rawData, source });
            throw error;
        }
        logger.error(`Unexpected normalization error: ${error.message}`, { rawData, source, error });
        throw new NormalizationError(`Normalization failed: ${error.message}`, 'unknown');
    }
}

/**
 * Validate required columns are present in CSV
 */
function validateRequiredColumns(headers) {
    const mapped = headers.map(h => mapColumnName(h)).filter(Boolean);

    const required = ['instance_id', 'instance_type', 'region'];
    const missing = required.filter(field => !mapped.includes(field));

    if (missing.length > 0) {
        return {
            valid: false,
            missing,
            message: `Missing required columns: ${missing.join(', ')}`
        };
    }

    return { valid: true };
}

module.exports = {
    normalizeVM,
    autoDetectColumns,
    validateRequiredColumns,
    detectCloudType,
    NormalizationError
};
