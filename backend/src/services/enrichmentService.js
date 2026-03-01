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
 * Singleton database pool for catalog queries
 */
let catalogPool = null;

function getCatalogPool() {
    if (!catalogPool) {
        const { Pool } = require('pg');
        catalogPool = new Pool({
            connectionString: process.env.POSTGRES_URL,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000
        });
    }
    return catalogPool;
}

/**
 * Query PostgreSQL catalog for instance specs
 * @param {string} cloud - Cloud provider ('aws', 'azure', 'gcp')
 * @param {string} instanceType - Instance type to lookup
 * @param {string} region - Region for the lookup
 * @returns {Promise<Object|null>} Specs from catalog or null if not found
 */
async function queryCatalogSpecs(cloud, instanceType, region) {
    try {
        const pool = getCatalogPool();

        let query, params;

        if (cloud === 'aws') {
            query = `
                SELECT vcpu_count, ram_gb 
                FROM aws_instance_sizes 
                WHERE instance_type = $1 AND region = $2
                LIMIT 1
            `;
            params = [instanceType, region];
        } else if (cloud === 'gcp') {
            query = `
                SELECT vcpu_count, ram_gb 
                FROM gcp_vm_sizes 
                WHERE instance_type = $1 AND region = $2
                LIMIT 1
            `;
            params = [instanceType, region];
        } else if (cloud === 'azure') {
            query = `
                SELECT vcpu_count, ram_gb 
                FROM azure_vm_sizes 
                WHERE vm_size = $1 AND region = $2
                LIMIT 1
            `;
            params = [instanceType, region];
        } else {
            return null;
        }

        const result = await pool.query(query, params);

        if (result.rows.length > 0) {
            logger.info('Catalog lookup successful', {
                cloud,
                instanceType,
                region,
                vcpu_count: result.rows[0].vcpu_count,
                ram_gb: result.rows[0].ram_gb
            });
            return {
                vcpu_count: result.rows[0].vcpu_count,
                ram_gb: result.rows[0].ram_gb
            };
        }

        logger.debug('Instance type not found in catalog', { cloud, instanceType, region });
        return null;
    } catch (error) {
        logger.error('Catalog query failed', {
            cloud,
            instanceType,
            region,
            error: error.message
        });
        return null;
    }
}

/**
 * Enrich VM with instance specs
 * Priority: 1) Catalog lookup (if has_instance_type flag), 2) CSV values, 3) Estimation
 * ONLY used for CSV uploads - cloud data already has real specs from APIs
 */
async function enrichWithSpecs(vm) {
    // If vcpu_count and ram_gb are explicitly set to non-null values, preserve them
    // This ensures cloud API data is never overridden
    // BUT: Allow null values to be enriched (for CSV uploads with catalog lookup)
    if (vm.vcpu_count !== undefined && vm.vcpu_count !== null &&
        vm.ram_gb !== undefined && vm.ram_gb !== null) {
        return vm;
    }

    // Check if we should query the catalog (flag set by normalization)
    if (vm.has_instance_type && vm.instance_type && vm.cloud && vm.region) {
        try {
            const catalogSpecs = await queryCatalogSpecs(vm.cloud, vm.instance_type, vm.region);

            if (catalogSpecs) {
                // Catalog lookup successful - use these values
                logger.info('Using catalog specs for instance', {
                    instance_type: vm.instance_type,
                    cloud: vm.cloud,
                    region: vm.region,
                    vcpu_count: catalogSpecs.vcpu_count,
                    ram_gb: catalogSpecs.ram_gb
                });

                return {
                    ...vm,
                    vcpu_count: catalogSpecs.vcpu_count,
                    ram_gb: catalogSpecs.ram_gb,
                    specs_source: 'catalog'
                };
            }
        } catch (error) {
            logger.warn('Catalog lookup failed, falling back to CSV or estimation', {
                instance_type: vm.instance_type,
                error: error.message
            });
        }

        // Catalog lookup failed - fall back to CSV values if available
        logger.debug('Catalog lookup failed, checking CSV values', {
            instance_type: vm.instance_type,
            has_csv_vcpu: vm.csv_vcpu_count !== undefined && vm.csv_vcpu_count !== null,
            has_csv_ram: vm.csv_ram_gb !== undefined && vm.csv_ram_gb !== null
        });

        // Check if CSV provided these values (stored separately during normalization)
        if (vm.csv_vcpu_count !== undefined && vm.csv_vcpu_count !== null &&
            vm.csv_ram_gb !== undefined && vm.csv_ram_gb !== null) {
            logger.info('Using CSV-provided specs as fallback', {
                instance_type: vm.instance_type,
                vcpu_count: vm.csv_vcpu_count,
                ram_gb: vm.csv_ram_gb
            });

            return {
                ...vm,
                vcpu_count: vm.csv_vcpu_count,
                ram_gb: vm.csv_ram_gb,
                specs_source: 'csv'
            };
        }
    }

    // Final fallback: estimate from instance type pattern
    const specs = estimateInstanceSpecs(vm.instance_type);

    logger.debug('Using estimated specs', {
        instance_type: vm.instance_type,
        vcpu_count: specs.vcpu,
        ram_gb: specs.ram_gb
    });

    return {
        ...vm,
        vcpu_count: vm.vcpu_count !== undefined ? vm.vcpu_count : specs.vcpu,
        ram_gb: vm.ram_gb !== undefined ? vm.ram_gb : specs.ram_gb,
        specs_source: 'estimated'
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
 * @returns {Promise<Object>} Enriched VM data
 */
async function enrichVM(normalizedVM) {
    try {
        let enriched = { ...normalizedVM };

        // Check if instance specs are unresolvable (vcpu_count and ram_gb are both null)
        // BUT: Skip this check for CSV uploads with has_instance_type flag (they will query catalog)
        const isUnresolvable = enriched.vcpu_count === null && enriched.ram_gb === null &&
            enriched.source === 'cloud' && !enriched.has_instance_type;

        if (isUnresolvable) {
            // Track unresolvable instance in database
            if (enriched.cloud && enriched.instance_type && enriched.region) {
                trackUnresolvableInstance(enriched.cloud, enriched.instance_type, enriched.region)
                    .catch(err => {
                        logger.error('Failed to track unresolvable instance in enrichVM', {
                            instance_id: enriched.instance_id,
                            error: err.message
                        });
                    });
            }

            // Set enrichment status and reason
            enriched.enrichment_status = 'unresolved';
            enriched.unresolved_reason = `Instance type '${enriched.instance_type}' not found in database. Specs could not be determined from cloud API.`;

            logger.warn('VM marked as unresolvable', {
                instance_id: enriched.instance_id,
                instance_type: enriched.instance_type,
                cloud: enriched.cloud,
                region: enriched.region
            });

            // Add enrichment metadata
            enriched.enriched_at = new Date().toISOString();

            return enriched;
        }

        // Step 1: Enrich with instance specs (only for CSV uploads) - now async
        enriched = await enrichWithSpecs(enriched);

        // Step 2: Estimate missing metrics
        enriched = estimateMetrics(enriched);

        // Step 3: Estimate cost if missing
        enriched = estimateCost(enriched);

        // Set enrichment status
        enriched.enrichment_status = 'complete';

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
            enrichment_status: 'error',
            enriched_at: new Date().toISOString()
        };
    }
}

/**
 * Enrich a batch of VMs
 * @param {Array} normalizedVMs - Array of normalized VM data
 * @returns {Promise<Array>} Array of enriched VM data
 */
async function enrichVMBatch(normalizedVMs) {
    return Promise.all(normalizedVMs.map(async vm => {
        try {
            return await enrichVM(vm);
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
    }));
}

/**
 * Track an unresolvable instance type in the database
 * @param {string} cloud - Cloud provider ('aws', 'azure', 'gcp')
 * @param {string} instanceType - Instance type that couldn't be resolved
 * @param {string} region - Region where the instance was detected
 * @returns {Promise<void>}
 */
async function trackUnresolvableInstance(cloud, instanceType, region) {
    try {
        // Validate inputs
        if (!cloud || !instanceType || !region) {
            logger.warn('Missing parameters for unresolvable instance tracking', {
                cloud,
                instanceType,
                region
            });
            return;
        }

        // For GCP, extract region from zone if needed (e.g., us-central1-c → us-central1)
        let lookupRegion = region;
        if (cloud === 'gcp' && region.includes('-') && region.split('-').length > 2) {
            const parts = region.split('-');
            lookupRegion = `${parts[0]}-${parts[1]}`;
            logger.debug('Extracted GCP region from zone for tracking', {
                originalZone: region,
                extractedRegion: lookupRegion
            });
        }

        // Connect to PostgreSQL
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

        // Insert into unknown_instance_types table
        // Use ON CONFLICT DO NOTHING to handle duplicates gracefully
        const query = `
            INSERT INTO unknown_instance_types (cloud, instance_type, region, detected_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (cloud, instance_type, region) DO NOTHING
        `;

        await pool.query(query, [cloud.toLowerCase(), instanceType, lookupRegion]);

        // Close the pool connection
        await pool.end();

        logger.info('Unresolvable instance type tracked', {
            cloud,
            instanceType,
            region: lookupRegion
        });

    } catch (error) {
        logger.error('Failed to track unresolvable instance type', {
            cloud,
            instanceType,
            region,
            error: error.message
        });
        // Don't throw - tracking failures shouldn't break the pipeline
    }
}

/**
 * Check if an instance type is available in a specific region
 * @param {string} cloud - Cloud provider ('aws', 'azure', 'gcp')
 * @param {string} instanceType - Instance type to check
 * @param {string} region - Region to check availability in
 * @returns {Promise<boolean>} True if available, false otherwise
 */
async function checkRegionAvailability(cloud, instanceType, region) {
    try {
        // Validate inputs
        if (!cloud || !instanceType || !region) {
            logger.warn('Missing parameters for region availability check', {
                cloud,
                instanceType,
                region
            });
            return false;
        }

        // For GCP, extract region from zone if needed (e.g., us-central1-c → us-central1)
        let lookupRegion = region;
        if (cloud === 'gcp' && region.includes('-') && region.split('-').length > 2) {
            // Extract region from zone format (e.g., us-central1-c → us-central1)
            const parts = region.split('-');
            lookupRegion = `${parts[0]}-${parts[1]}`;
            logger.debug('Extracted GCP region from zone', {
                originalZone: region,
                extractedRegion: lookupRegion
            });
        }

        // Connect to PostgreSQL
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

        // Determine the correct table and column names based on cloud provider
        let tableName, instanceColumn;
        switch (cloud.toLowerCase()) {
            case 'aws':
                tableName = 'aws_instance_sizes';
                instanceColumn = 'instance_type';
                break;
            case 'azure':
                tableName = 'azure_vm_sizes';
                instanceColumn = 'vm_size';
                break;
            case 'gcp':
                tableName = 'gcp_vm_sizes';
                instanceColumn = 'instance_type';
                break;
            default:
                logger.error('Invalid cloud provider for region availability check', { cloud });
                return false;
        }

        // Query the database for availability
        const query = `
            SELECT 1 
            FROM ${tableName} 
            WHERE ${instanceColumn} = $1 
              AND region = $2 
              AND available = true
            LIMIT 1
        `;

        const result = await pool.query(query, [instanceType, lookupRegion]);

        // Close the pool connection
        await pool.end();

        const isAvailable = result.rows.length > 0;

        logger.debug('Region availability check completed', {
            cloud,
            instanceType,
            region: lookupRegion,
            available: isAvailable
        });

        return isAvailable;

    } catch (error) {
        logger.error('Region availability check failed', {
            cloud,
            instanceType,
            region,
            error: error.message
        });

        // Return false on error to be safe (don't recommend unavailable instances)
        return false;
    }
}

module.exports = {
    enrichVM,
    enrichVMBatch,
    estimateInstanceSpecs,
    estimateMetrics,
    checkRegionAvailability,
    trackUnresolvableInstance
};
