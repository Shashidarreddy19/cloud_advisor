const mapResourceType = (cloud, instanceType) => {
    if (!cloud) return "ec2";
    const lowerCloud = cloud.toLowerCase();

    if (lowerCloud === 'aws') {
        return (instanceType && instanceType.startsWith('db.')) ? 'rds' : 'ec2';
    } else if (lowerCloud === 'azure') {
        return (instanceType && instanceType.includes('SQL')) ? 'sql' : 'vm';
    } else if (lowerCloud === 'gcp') {
        return (instanceType && instanceType.includes('sql')) ? 'cloud_sql' : 'compute_engine';
    }
    return "ec2";
};

const getDoubleValue = (map, defaultValue, ...keys) => {
    for (const key of keys) {
        const value = map[key];
        if (value !== undefined && value !== null && value !== '') {
            const parsed = parseFloat(value);
            if (!isNaN(parsed)) return parsed;
        }
    }
    return defaultValue;
};

const getStringValueWithDefault = (map, defaultValue, ...keys) => {
    for (const key of keys) {
        const value = map[key];
        if (value !== undefined && value !== null && value !== '') {
            return String(value);
        }
    }
    return defaultValue;
};

const normalizeFromFile = (rawData) => {
    return rawData.map((row, index) => {
        const normalized = {};

        // Cloud provider
        const cloud = getStringValueWithDefault(row, "aws", "cloud", "provider", "cloud_provider").toLowerCase();
        normalized.cloud = cloud;
        normalized.cloud_provider = cloud;

        // Instance Type - CRITICAL: must include current_type for database CSVs
        const instanceType = getStringValueWithDefault(row, "unknown", "current_type", "instance_type", "type", "current_vm_type", "vm_type", "instanceType");
        normalized.instanceType = instanceType;
        normalized.instance_type = instanceType;
        normalized.current_type = instanceType;

        // Resource type (vm vs database) - PRIORITY: Use CSV value if present, otherwise auto-detect
        const csvResourceType = getStringValueWithDefault(row, null, "resource_type", "resourceType", "service");
        if (csvResourceType) {
            // CSV has explicit resource_type - use it!
            normalized.resourceType = csvResourceType;
            normalized.resource_type = csvResourceType;
        } else {
            // No CSV resource_type - auto-detect from instance type
            normalized.resourceType = mapResourceType(cloud, instanceType);
            normalized.resource_type = normalized.resourceType;
        }

        // Resource ID
        normalized.resourceId = getStringValueWithDefault(row, `resource-${index + 1}`, "resource_id", "instance_id", "id", "resourceId", "vm_id");
        normalized.resource_id = normalized.resourceId;

        // Name
        normalized.name = getStringValueWithDefault(row, normalized.resourceId, "name", "resource_name", "instance_name");

        // CPU Metrics
        normalized.cpuAvg = getDoubleValue(row, 0.0, "cpu_avg", "cpu_usage", "cpu_util", "cpu_usage_percent", "avg_cpu", "cpuAvg");
        normalized.cpu_avg = normalized.cpuAvg;
        normalized.cpuP95 = getDoubleValue(row, normalized.cpuAvg, "cpu_p95", "cpu_95", "cpuP95", "cpu_max");
        normalized.cpu_p95 = normalized.cpuP95;

        // Memory Metrics
        normalized.memoryAvg = getDoubleValue(row, 0.0, "memory_avg", "memory_usage", "mem_util", "memory_usage_percent", "memoryAvg", "mem_avg");
        normalized.memory_avg = normalized.memoryAvg;
        normalized.memoryP95 = getDoubleValue(row, normalized.memoryAvg, "memory_p95", "mem_p95", "memoryP95", "memory_max");
        normalized.memory_p95 = normalized.memoryP95;

        // Disk Metrics
        normalized.diskReadAvg = getDoubleValue(row, 0.0, "disk_read_avg", "disk_read", "diskReadAvg", "disk_read_iops");
        normalized.disk_read_avg = normalized.diskReadAvg;
        normalized.diskWriteAvg = getDoubleValue(row, 0.0, "disk_write_avg", "disk_write", "diskWriteAvg", "disk_write_iops");
        normalized.disk_write_avg = normalized.diskWriteAvg;
        normalized.disk_read_iops = normalized.diskReadAvg;
        normalized.disk_write_iops = normalized.diskWriteAvg;
        normalized.diskIops = getDoubleValue(row, normalized.diskReadAvg + normalized.diskWriteAvg, "disk_iops", "iops", "diskIops");

        // Network Metrics
        normalized.networkInAvg = getDoubleValue(row, 0.0, "network_in_avg", "network_in", "net_in", "network_in_bytes", "networkInAvg");
        normalized.network_in_avg = normalized.networkInAvg;
        normalized.networkOutAvg = getDoubleValue(row, 0.0, "network_out_avg", "network_out", "net_out", "network_out_bytes", "networkOutAvg");
        normalized.network_out_avg = normalized.networkOutAvg;
        normalized.network_in_bytes = normalized.networkInAvg;
        normalized.network_out_bytes = normalized.networkOutAvg;
        normalized.networkIn = normalized.networkInAvg;
        normalized.networkOut = normalized.networkOutAvg;

        // Database-specific metrics
        normalized.connectionsAvg = getDoubleValue(row, 0.0, "connections_avg", "connections", "db_connections", "connectionsAvg");
        normalized.connections_avg = normalized.connectionsAvg;
        normalized.connectionsP95 = getDoubleValue(row, normalized.connectionsAvg, "connections_p95", "connectionsP95", "connections_max");
        normalized.connections_p95 = normalized.connectionsP95;
        normalized.iopsReadAvg = getDoubleValue(row, normalized.diskReadAvg, "iops_read_avg", "iops_read", "iopsReadAvg");
        normalized.iops_read_avg = normalized.iopsReadAvg;
        normalized.iopsWriteAvg = getDoubleValue(row, normalized.diskWriteAvg, "iops_write_avg", "iops_write", "iopsWriteAvg");
        normalized.iops_write_avg = normalized.iopsWriteAvg;
        normalized.storageGb = getDoubleValue(row, 0.0, "storage_gb", "storage", "disk_size", "storageGb");
        normalized.storage_gb = normalized.storageGb;

        // Cost and Age
        normalized.costPerMonth = getDoubleValue(row, 0.0, "cost_per_month", "monthly_cost", "cost", "costPerMonth");
        normalized.cost_per_month = normalized.costPerMonth;
        normalized.instanceAgeDays = getDoubleValue(row, 0, "instance_age_days", "age_days", "age", "instanceAgeDays");
        normalized.instance_age_days = normalized.instanceAgeDays;
        normalized.uptime_hours = normalized.instanceAgeDays * 24;

        // Instance specs (for ML service)
        normalized.vcpuCount = getDoubleValue(row, 2, "vcpu_count", "vcpus", "cpu_count", "cores", "vcpuCount");
        normalized.vcpu_count = normalized.vcpuCount;
        normalized.ramGb = getDoubleValue(row, 4, "ram_gb", "memory_gb", "ram", "memory", "ramGb");
        normalized.ram_gb = normalized.ramGb;

        // Metadata
        normalized.region = getStringValueWithDefault(row, "us-east-1", "region", "zone", "location");
        normalized.instanceType = instanceType;
        normalized.instance_type = instanceType;
        normalized.status = getStringValueWithDefault(row, "running", "status", "state");
        normalized.timestamp = new Date();

        return normalized;
    });
};

module.exports = {
    normalizeFromFile,
    mapResourceType
};
