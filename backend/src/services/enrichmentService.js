const logger = require('../utils/logger');

/**
 * Enrichment Service
 * Enriches normalized VM data with instance specs and estimated metrics
 * This layer runs after normalization for BOTH file and cloud sources
 */

/**
 * Instance family specifications (fallback when no other data available)
 */
const INSTANCE_SPECS = {
    // AWS
    't2.micro': { vcpu: 1, ram_gb: 1 },
    't2.small': { vcpu: 1, ram_gb: 2 },
    't2.medium': { vcpu: 2, ram_gb: 4 },
    't2.large': { vcpu: 2, ram_gb: 8 },
    't3.micro': { vcpu: 2, ram_gb: 1 },
    't3.small': { vcpu: 2, ram_gb: 2 },
    't3.medium': { vcpu: 2, ram_gb: 4 },
    't3.large': { vcpu: 2, ram_gb: 8 },
    'm5.large': { vcpu: 2, ram_gb: 8 },
    'm5.xlarge': { vcpu: 4, ram_gb: 16 },
    'm5.2xlarge': { vcpu: 8, ram_gb: 32 },
    'm5.4xlarge': { vcpu: 16, ram_gb: 64 },
    'c5.large': { vcpu: 2, ram_gb: 4 },
    'c5.xlarge': { vcpu: 4, ram_gb: 8 },
    'c5.2xlarge': { vcpu: 8, ram_gb: 16 },
    'c5.4xlarge': { vcpu: 16, ram_gb: 32 },
    'r5.large': { vcpu: 2, ram_gb: 16 },
    'r5.xlarge': { vcpu: 4, ram_gb: 32 },
    'r5.2xlarge': { vcpu: 8, ram_gb: 64 },

    // GCP
    'e2-micro': { vcpu: 2, ram_gb: 1 },
    'e2-small': { vcpu: 2, ram_gb: 2 },
    'e2-medium': { vcpu: 2, ram_gb: 4 },
    'e2-standard-2': { vcpu: 2, ram_gb: 8 },
    'e2-standard-4': { vcpu: 4, ram_gb: 16 },
    'n1-standard-1': { vcpu: 1, ram_gb: 3.75 },
    'n1-standard-2': { vcpu: 2, ram_gb: 7.5 },
    'n1-standard-4': { vcpu: 4, ram_gb: 15 },
    'n2-standard-2': { vcpu: 2, ram_gb: 8 },
    'n2-standard-4': { vcpu: 4, ram_gb: 16 },

    // Azure
    'Standard_B1s': { vcpu: 1, ram_gb: 1 },
    'Standard_B2s': { vcpu: 2, ram_gb: 4 },
    'Standard_D2s_v3': { vcpu: 2, ram_gb: 8 },
    'Standard_D4s_v3': { vcpu: 4, ram_gb: 16 },
    'Standard_D8s_v3': { vcpu: 8, ram_gb: 32 },
};

/**
 * Estimate instance specs based on naming patterns
 */
function estimateInstanceSpecs(instanceType) {
    // Check exact match first
    if (INSTANCE_SPECS[instanceType]) {
        return INSTANCE_SPECS[instanceType];
    }

    const type = instanceType.toLowerCase();

    // AWS pattern matching
    if (type.includes('micro')) return { vcpu: 1, ram_gb: 1 };
    if (type.includes('small')) return { vcpu: 1, ram_gb: 2 };
    if (type.includes('medium')) return { vcpu: 2, ram_gb: 4 };
    if (type.includes('large') && !type.includes('xlarge')) return { vcpu: 2, ram_gb: 8 };
    if (type.includes('xlarge')) {
        // Extract multiplier (2xlarge, 4xlarge, etc.)
        const match = type.match(/(\d+)xlarge/);
        if (match) {
            const multiplier = parseInt(match[1]);
            return { vcpu: 4 * multiplier, ram_gb: 16 * multiplier };
        }
        return { vcpu: 4, ram_gb: 16 };
    }

    // GCP pattern matching
    if (type.startsWith('e2-')) {
        const match = type.match(/e2-standard-(\d+)/);
        if (match) {
            const vcpu = parseInt(match[1]);
            return { vcpu, ram_gb: vcpu * 4 };
        }
    }

    if (type.startsWith('n1-') || type.startsWith('n2-')) {
        const match = type.match(/n[12]-standard-(\d+)/);
        if (match) {
            const vcpu = parseInt(match[1]);
            return { vcpu, ram_gb: vcpu * 3.75 };
        }
    }

    // Azure pattern matching
    if (type.includes('standard_d')) {
        const match = type.match(/d(\d+)/);
        if (match) {
            const vcpu = parseInt(match[1]);
            return { vcpu, ram_gb: vcpu * 4 };
        }
    }

    // Default fallback
    return { vcpu: 2, ram_gb: 4 };
}

/**
 * Estimate missing metrics based on available data
 */
function estimateMetrics(vm) {
    const estimated = { ...vm };

    // If we have avg but not p95, estimate p95 as avg * 1.5
    if (estimated.cpu_avg > 0 && estimated.cpu_p95 === 0) {
        estimated.cpu_p95 = Math.min(100, estimated.cpu_avg * 1.5);
    }

    if (estimated.memory_avg > 0 && estimated.memory_p95 === 0) {
        estimated.memory_p95 = Math.min(100, estimated.memory_avg * 1.5);
    }

    // If we have p95 but not avg, estimate avg as p95 * 0.7
    if (estimated.cpu_p95 > 0 && estimated.cpu_avg === 0) {
        estimated.cpu_avg = estimated.cpu_p95 * 0.7;
    }

    if (estimated.memory_p95 > 0 && estimated.memory_avg === 0) {
        estimated.memory_avg = estimated.memory_p95 * 0.7;
    }

    // Estimate disk IOPS if missing (based on instance size)
    if (estimated.disk_read_iops === 0 && estimated.disk_write_iops === 0) {
        const baseIOPS = estimated.vcpu_count * 100;
        estimated.disk_read_iops = baseIOPS;
        estimated.disk_write_iops = baseIOPS * 0.5;
    }

    // Estimate network if missing (based on instance size)
    if (estimated.network_in_bytes === 0 && estimated.network_out_bytes === 0) {
        const baseNetwork = estimated.vcpu_count * 1000000; // 1MB per vCPU
        estimated.network_in_bytes = baseNetwork;
        estimated.network_out_bytes = baseNetwork * 0.5;
    }

    return estimated;
}

/**
 * Enrich VM with instance specs
 * ONLY used for CSV uploads - cloud data already has real specs from APIs
 */
function enrichWithSpecs(vm) {
    // If vcpu_count and ram_gb are explicitly set (even if zero or null), preserve them
    // This ensures cloud API data (including null) is never overridden
    if (vm.vcpu_count !== undefined && vm.ram_gb !== undefined) {
        return vm;
    }

    // Only estimate for CSV uploads where specs are completely missing
    const specs = estimateInstanceSpecs(vm.instance_type);

    return {
        ...vm,
        vcpu_count: vm.vcpu_count !== undefined ? vm.vcpu_count : specs.vcpu,
        ram_gb: vm.ram_gb !== undefined ? vm.ram_gb : specs.ram_gb
    };
}

/**
 * Estimate cost if not provided
 */
function estimateCost(vm) {
    if (vm.cost_per_month > 0) {
        return vm;
    }

    // Simple cost estimation based on instance specs
    // These are rough estimates - real pricing should come from ML service
    const baseCostPerVCPU = 10; // $10 per vCPU per month
    const baseCostPerGB = 2;    // $2 per GB RAM per month

    const estimatedCost = (vm.vcpu_count * baseCostPerVCPU) + (vm.ram_gb * baseCostPerGB);

    return {
        ...vm,
        cost_per_month: Math.round(estimatedCost * 100) / 100
    };
}

/**
 * Main enrichment function
 * @param {Object} normalizedVM - Normalized VM data
 * @returns {Object} Enriched VM data
 */
function enrichVM(normalizedVM) {
    try {
        let enriched = { ...normalizedVM };

        // Step 1: Enrich with instance specs
        enriched = enrichWithSpecs(enriched);

        // Step 2: Estimate missing metrics
        enriched = estimateMetrics(enriched);

        // Step 3: Estimate cost if missing
        enriched = estimateCost(enriched);

        // Add enrichment metadata
        enriched.enriched_at = new Date().toISOString();

        logger.debug('VM enriched successfully', {
            instance_id: enriched.instance_id,
            instance_type: enriched.instance_type
        });

        return enriched;

    } catch (error) {
        logger.error('Enrichment failed', {
            instance_id: normalizedVM.instance_id,
            error: error.message
        });

        // Return original data with error flag
        return {
            ...normalizedVM,
            enrichment_error: error.message,
            enriched_at: new Date().toISOString()
        };
    }
}

/**
 * Enrich a batch of VMs
 * @param {Array} normalizedVMs - Array of normalized VM data
 * @returns {Array} Array of enriched VM data
 */
function enrichVMBatch(normalizedVMs) {
    return normalizedVMs.map(vm => {
        try {
            return enrichVM(vm);
        } catch (error) {
            logger.error('Batch enrichment failed for VM', {
                instance_id: vm.instance_id,
                error: error.message
            });
            return {
                ...vm,
                enrichment_error: error.message,
                enriched_at: new Date().toISOString()
            };
        }
    });
}

module.exports = {
    enrichVM,
    enrichVMBatch,
    estimateInstanceSpecs,
    estimateMetrics
};
