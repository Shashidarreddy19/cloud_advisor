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
    instance_id: ['instance_id', 'instanceid', 'instance-id', 'id', 'vm_id', 'vmid', 'resource_id'],
    instance_type: ['instance_type', 'instancetype', 'instance-type', 'type', 'vm_size', 'vmsize', 'size', 'machine_type'],

    // Location
    region: ['region', 'location', 'zone', 'availability_zone', 'az'],
    cloud: ['cloud', 'provider', 'cloud_provider'],
    account_id: ['account_id', 'accountid', 'account', 'subscription_id', 'project_id'],

    // OS
    os: ['os', 'operating_system', 'platform', 'os_type'],

    // CPU metrics
    cpu_avg: ['cpu_avg', 'avg_cpu', 'cpu_average', 'average_cpu', 'cpu%', 'cpu_util', 'cpu_utilization', 'cpuavg'],
    cpu_p95: ['cpu_p95', 'p95_cpu', 'cpu_95', '95_cpu', 'cpu_p95_util', 'p95cpu'],

    // Memory metrics
    memory_avg: ['memory_avg', 'avg_memory', 'mem_avg', 'avg_mem', 'memory%', 'mem%', 'memory_util', 'memavg'],
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
    cost_per_month: ['cost_per_month', 'monthly_cost', 'cost', 'price', 'monthly_price', 'cost_month']
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

    // Required fields
    const instance_id = parseString(data.instance_id, 'instance_id', true);
    const instance_type = parseString(data.instance_type, 'instance_type', true);
    const region = parseString(data.region, 'region', true);

    // Detect cloud if not provided
    const cloud = parseString(data.cloud, 'cloud') || detectCloudType(rawData);

    // Optional fields with defaults
    const account_id = parseString(data.account_id, 'account_id') || 'unknown';
    const os = parseString(data.os, 'os') || 'Linux';

    // ML features - with validation
    const cpu_avg = parseNumber(data.cpu_avg, 'cpu_avg', 0, 100) || 0;
    const cpu_p95 = parseNumber(data.cpu_p95, 'cpu_p95', 0, 100) || cpu_avg;
    const memory_avg = parseNumber(data.memory_avg, 'memory_avg', 0, 100) || 0;
    const memory_p95 = parseNumber(data.memory_p95, 'memory_p95', 0, 100) || memory_avg;

    const disk_read_iops = parseNumber(data.disk_read_iops, 'disk_read_iops', 0) || 0;
    const disk_write_iops = parseNumber(data.disk_write_iops, 'disk_write_iops', 0) || 0;
    const network_in_bytes = parseNumber(data.network_in_bytes, 'network_in_bytes', 0) || 0;
    const network_out_bytes = parseNumber(data.network_out_bytes, 'network_out_bytes', 0) || 0;

    const vcpu_count = parseNumber(data.vcpu_count, 'vcpu_count', 0) || 2;
    const ram_gb = parseNumber(data.ram_gb, 'ram_gb', 0) || 4;
    const uptime_hours = parseNumber(data.uptime_hours, 'uptime_hours', 0) || 720;
    const cost_per_month = parseNumber(data.cost_per_month, 'cost_per_month', 0) || 0;

    return {
        cloud,
        account_id,
        region,
        instance_id,
        instance_type,
        os,
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
 */
function normalizeAWS(rawData) {
    return {
        cloud: 'aws',
        account_id: parseString(rawData.account_id, 'account_id') || 'unknown',
        region: parseString(rawData.region, 'region', true),
        instance_id: parseString(rawData.instance_id, 'instance_id', true),
        instance_type: parseString(rawData.instance_type, 'instance_type', true),
        os: parseString(rawData.os || rawData.platform, 'os') || 'Linux',

        // Metrics from CloudWatch
        cpu_avg: parseNumber(rawData.cpu_avg, 'cpu_avg', 0, 100) || 0,
        cpu_p95: parseNumber(rawData.cpu_p95, 'cpu_p95', 0, 100) || 0,
        memory_avg: parseNumber(rawData.memory_avg, 'memory_avg', 0, 100) || 0,
        memory_p95: parseNumber(rawData.memory_p95, 'memory_p95', 0, 100) || 0,
        disk_read_iops: parseNumber(rawData.disk_read_iops, 'disk_read_iops', 0) || 0,
        disk_write_iops: parseNumber(rawData.disk_write_iops, 'disk_write_iops', 0) || 0,
        network_in_bytes: parseNumber(rawData.network_in_bytes || rawData.network_in, 'network_in_bytes', 0) || 0,
        network_out_bytes: parseNumber(rawData.network_out_bytes || rawData.network_out, 'network_out_bytes', 0) || 0,

        // Instance specs
        vcpu_count: parseNumber(rawData.vcpu_count, 'vcpu_count', 0) || 2,
        ram_gb: parseNumber(rawData.ram_gb, 'ram_gb', 0) || 4,
        uptime_hours: parseNumber(rawData.uptime_hours, 'uptime_hours', 0) || 720,
        cost_per_month: parseNumber(rawData.cost_per_month, 'cost_per_month', 0) || 0,

        source: 'cloud'
    };
}

/**
 * Normalize GCP Compute Engine instance data
 */
function normalizeGCP(rawData) {
    return {
        cloud: 'gcp',
        account_id: parseString(rawData.project_id, 'account_id') || 'unknown',
        region: parseString(rawData.region || rawData.zone, 'region', true), // Accept both region and zone
        instance_id: parseString(rawData.instance_id, 'instance_id', true),
        instance_type: parseString(rawData.instance_type || rawData.machine_type, 'instance_type', true), // Accept both
        os: parseString(rawData.os, 'os') || 'Linux',

        // Metrics from Cloud Monitoring
        cpu_avg: parseNumber(rawData.cpu_avg, 'cpu_avg', 0, 100) || 0,
        cpu_p95: parseNumber(rawData.cpu_p95, 'cpu_p95', 0, 100) || 0,
        memory_avg: parseNumber(rawData.memory_avg, 'memory_avg', 0, 100) || 0,
        memory_p95: parseNumber(rawData.memory_p95, 'memory_p95', 0, 100) || 0,
        disk_read_iops: parseNumber(rawData.disk_read_iops, 'disk_read_iops', 0) || 0,
        disk_write_iops: parseNumber(rawData.disk_write_iops, 'disk_write_iops', 0) || 0,
        network_in_bytes: parseNumber(rawData.network_in_bytes || rawData.network_in, 'network_in_bytes', 0) || 0,
        network_out_bytes: parseNumber(rawData.network_out_bytes || rawData.network_out, 'network_out_bytes', 0) || 0,

        // Instance specs
        vcpu_count: parseNumber(rawData.vcpu_count, 'vcpu_count', 0) || 2,
        ram_gb: parseNumber(rawData.ram_gb, 'ram_gb', 0) || 4,
        uptime_hours: parseNumber(rawData.uptime_hours, 'uptime_hours', 0) || 720,
        cost_per_month: parseNumber(rawData.cost_per_month, 'cost_per_month', 0) || 0,

        source: 'cloud'
    };
}

/**
 * Normalize Azure VM data
 */
function normalizeAzure(rawData) {
    return {
        cloud: 'azure',
        account_id: parseString(rawData.subscription_id || rawData.account_id, 'account_id') || 'unknown',
        region: parseString(rawData.region || rawData.location, 'region', true),
        instance_id: parseString(rawData.instance_id || rawData.vm_id, 'instance_id', true),
        instance_type: parseString(rawData.instance_type || rawData.vm_size, 'instance_type', true),
        os: parseString(rawData.os || rawData.os_type, 'os') || 'Linux',

        // Metrics from Azure Monitor
        cpu_avg: parseNumber(rawData.cpu_avg, 'cpu_avg', 0, 100) || 0,
        cpu_p95: parseNumber(rawData.cpu_p95, 'cpu_p95', 0, 100) || 0,
        memory_avg: parseNumber(rawData.memory_avg, 'memory_avg', 0, 100) || 0,
        memory_p95: parseNumber(rawData.memory_p95, 'memory_p95', 0, 100) || 0,
        disk_read_iops: parseNumber(rawData.disk_read_iops, 'disk_read_iops', 0) || 0,
        disk_write_iops: parseNumber(rawData.disk_write_iops, 'disk_write_iops', 0) || 0,
        network_in_bytes: parseNumber(rawData.network_in_bytes || rawData.network_in, 'network_in_bytes', 0) || 0,
        network_out_bytes: parseNumber(rawData.network_out_bytes || rawData.network_out, 'network_out_bytes', 0) || 0,

        // Instance specs
        vcpu_count: parseNumber(rawData.vcpu_count, 'vcpu_count', 0) || 2,
        ram_gb: parseNumber(rawData.ram_gb, 'ram_gb', 0) || 4,
        uptime_hours: parseNumber(rawData.uptime_hours, 'uptime_hours', 0) || 720,
        cost_per_month: parseNumber(rawData.cost_per_month, 'cost_per_month', 0) || 0,

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
