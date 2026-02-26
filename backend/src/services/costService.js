// VM Thresholds
const VM_CPU_UND_THRESHOLD = 75.0; // Undersized if > 75%
const VM_MEM_UND_THRESHOLD = 70.0; // Undersized if > 70%
const VM_CPU_OVR_THRESHOLD = 30.0; // Oversized if < 30%
const VM_MEM_OVR_THRESHOLD = 40.0; // Oversized if < 40%

// DB Thresholds
const DB_HIGH_THRESHOLD = 80.0;
const DB_LOW_THRESHOLD = 30.0;

const getDouble = (metrics, key) => {
    const val = metrics[key];
    if (val === undefined || val === null) return null;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
};

const getDownsizedType = (current) => {
    if (!current || current === "unknown") return null;
    if (current.endsWith(".2xlarge")) return current.replace(".2xlarge", ".xlarge");
    if (current.endsWith(".xlarge")) return current.replace(".xlarge", ".large");
    if (current.endsWith(".large")) return current.replace(".large", ".medium");
    if (current.endsWith(".medium")) return current.replace(".medium", ".small");
    return current + "_optimized";
};

const getUpsizedType = (current) => {
    if (!current || current === "unknown") return null;
    if (current.endsWith(".nano")) return current.replace(".nano", ".micro");
    if (current.endsWith(".micro")) return current.replace(".micro", ".small");
    if (current.endsWith(".small")) return current.replace(".small", ".medium");
    if (current.endsWith(".medium")) return current.replace(".medium", ".large");
    if (current.endsWith(".large")) return current.replace(".large", ".xlarge");
    return current + "_upgraded";
};

const getDownsizedDbType = (current) => {
    if (current && current.includes("db.")) {
        if (current.endsWith(".2xlarge")) return current.replace(".2xlarge", ".xlarge");
        if (current.endsWith(".xlarge")) return current.replace(".xlarge", ".large");
        if (current.endsWith(".large")) return current.replace(".large", ".medium");
    }
    return current + "_optimized";
};

const getUpsizedDbType = (current) => {
    if (current && current.includes("db.")) {
        if (current.endsWith(".medium")) return current.replace(".medium", ".large");
        if (current.endsWith(".large")) return current.replace(".large", ".xlarge");
    }
    return current + "_upgraded";
};

const calculateConfidence = (cpu, mem, isDownsize) => {
    if (isDownsize) {
        const score = 100.0 - (cpu + mem) / 2.0;
        return Math.min(100.0, Math.max(50.0, score));
    } else {
        const score = (cpu + mem) / 2.0;
        return Math.min(100.0, Math.max(50.0, score));
    }
};

const createInsufficientDataResponse = (metrics, reason) => {
    return {
        ...metrics,
        status: "insufficient_data",
        finding: "Insufficient Data",
        reason: reason,
        recommended_type: metrics.current_vm_type || "unknown",
        savings: 0.0,
        confidence_score: 0.0,
        estimated_cost_change: "$0.00"
    };
};

const populateResult = (result, status, finding, reason, currentType, recommendedType, currentCost, recommendedCost, confidence) => {
    result.status = status;
    result.finding = finding;
    result.reason = reason;
    result.current_vm = currentType;
    result.recommended_vm = recommendedType;
    result.recommended_type = recommendedType;

    result.current_cost_per_hour = currentCost;
    result.recommended_cost_per_hour = recommendedCost;
    result.confidence_score = confidence;

    const monthlySavings = (currentCost - recommendedCost) * 730;
    result.savings = monthlySavings;

    if (status === "undersized") {
        result.estimated_cost_change = "+$" + Math.abs(monthlySavings).toFixed(2);
    } else if (status === "oversized") {
        result.estimated_cost_change = "-$" + Math.abs(monthlySavings).toFixed(2);
    } else {
        result.estimated_cost_change = "$0.00";
    }

    return result;
};

const analyzeVM = (metrics) => {
    const result = { ...metrics };
    let cpu = getDouble(metrics, "cpu_usage_percent");
    let mem = getDouble(metrics, "memory_usage_percent");
    const currentType = metrics.current_vm_type || "unknown";
    const resourceId = metrics.instance_id || "unknown";

    result.resource_type = "vm";
    result.resource_id = resourceId;
    result.current_type = currentType;

    // Use default values if missing to avoid hard failure, or return insufficient data
    if (cpu === null) cpu = metrics.cpuAvg || 10.0;
    if (mem === null) mem = metrics.memoryAvg || 20.0;

    // If still null (should not be reached if defaults are applied correctly previously)
    if (cpu === null || mem === null) {
        return createInsufficientDataResponse(metrics, "Insufficient data: Missing CPU or Memory metrics");
    }

    // Clamp
    cpu = Math.max(0, Math.min(100, cpu));
    mem = Math.max(0, Math.min(100, mem));

    let finding = "Optimal";
    let status = "optimal";
    let reason = "Usage within normal limits";
    let recommendedType = currentType;
    let currentCost = 0.10;
    let recommendedCost = 0.10;
    let confidence = 0.0;

    if (cpu > VM_CPU_UND_THRESHOLD || mem > VM_MEM_UND_THRESHOLD) {
        status = "undersized";
        finding = "Undersized";
        reason = `Resource Undersized (CPU > ${VM_CPU_UND_THRESHOLD}% or Mem > ${VM_MEM_UND_THRESHOLD}%)`;
        recommendedType = getUpsizedType(currentType);
        recommendedCost = currentCost * 1.5;
        confidence = calculateConfidence(cpu, mem, false);
    } else if (cpu < VM_CPU_OVR_THRESHOLD && mem < VM_MEM_OVR_THRESHOLD) {
        status = "oversized";
        finding = "Oversized";
        reason = `Resource Oversized (CPU < ${VM_CPU_OVR_THRESHOLD}% and Mem < ${VM_MEM_OVR_THRESHOLD}%)`;
        recommendedType = getDownsizedType(currentType);
        recommendedCost = currentCost * 0.5;
        confidence = calculateConfidence(cpu, mem, true);
    } else {
        status = "optimal";
        finding = "Optimal";
        confidence = 90.0;
    }

    return populateResult(result, status, finding, reason, currentType, recommendedType, currentCost, recommendedCost, confidence);
};

const analyzeDatabase = (metrics) => {
    const result = { ...metrics };
    let cpu = getDouble(metrics, "cpu_usage_percent");
    let mem = getDouble(metrics, "memory_usage_percent");
    let diskIo = getDouble(metrics, "disk_io_percent");
    let connections = getDouble(metrics, "connection_usage_percent");

    const currentType = metrics.current_vm_type || "db.unknown";
    const resourceId = metrics.instance_id || "unknown";

    result.resource_type = "database";
    result.resource_id = resourceId;
    result.current_type = currentType;

    if (cpu === null) cpu = metrics.cpuAvg || 10.0;
    if (mem === null) mem = metrics.memoryAvg || 20.0;

    if (cpu === null || mem === null) {
        return createInsufficientDataResponse(metrics, "Insufficient data: Missing DB metrics");
    }

    cpu = Math.max(0, Math.min(100, cpu));
    mem = Math.max(0, Math.min(100, mem));

    let finding = "Optimal";
    let status = "optimal";
    let reason = "Database usage within normal limits";
    let recommendedType = currentType;
    let currentCost = 0.20;
    let recommendedCost = 0.20;
    let confidence = 85.0;

    const isHighUsage = (cpu > DB_HIGH_THRESHOLD || mem > DB_HIGH_THRESHOLD || (diskIo != null && diskIo > 80.0));
    const isLowUsage = (cpu < DB_LOW_THRESHOLD && mem < DB_LOW_THRESHOLD && (connections == null || connections < 20.0));

    if (isHighUsage) {
        status = "undersized";
        finding = "Undersized";
        reason = `High DB Load (CPU/Mem > ${DB_HIGH_THRESHOLD}%)`;
        recommendedType = getUpsizedDbType(currentType);
        recommendedCost = currentCost * 1.5;
        confidence = 90.0;
    } else if (isLowUsage) {
        status = "oversized";
        finding = "Oversized";
        reason = `Low DB Load (CPU/Mem < ${DB_LOW_THRESHOLD}%)`;
        recommendedType = getDownsizedDbType(currentType);
        recommendedCost = currentCost * 0.6;
        confidence = 80.0;
    }

    return populateResult(result, status, finding, reason, currentType, recommendedType, currentCost, recommendedCost, confidence);
};

const analyze = (metrics) => {
    const resourceType = metrics.resourceType || metrics.resource_type || "vm";
    const uptime = getDouble(metrics, "uptime_hours");

    if (uptime !== null && uptime < 24.0) {
        return createInsufficientDataResponse(metrics, "Insufficient data: Runtime < 24h");
    }

    if (["database", "rds", "sql", "cloud_sql"].includes(resourceType.toLowerCase())) {
        return analyzeDatabase(metrics);
    } else {
        return analyzeVM(metrics);
    }
};

module.exports = { analyze };
