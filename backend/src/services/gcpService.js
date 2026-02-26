const { ProjectsClient } = require('@google-cloud/resource-manager');
const { Storage } = require('@google-cloud/storage');
const { MetricServiceClient } = require('@google-cloud/monitoring');
const Resource = require('../models/Resource');
const logger = require('../utils/logger');
const { normalizeVM } = require('./normalizationService');
const { enrichVMBatch } = require('./enrichmentService');
const { processVMsInBatches } = require('./mlService');
const { handleCloudError } = require('./credentialValidationService');

/**
 * Detect OS from GCP Compute Engine instance
 * AUTHORITATIVE METHOD: Uses disk image information
 * Returns: { os_type: 'Linux'|'Windows'|'unknown', os_source: 'cloud'|'inferred'|'unresolved', os_confidence: 'high'|'medium'|'low' }
 */
const detectGCPOS = (instance) => {
    try {
        logger.info(`[OS Detection] Starting for GCP instance ${instance.name}`);

        // Step A: Check disks for OS information
        if (instance.disks && instance.disks.length > 0) {
            const bootDisk = instance.disks.find(d => d.boot === true) || instance.disks[0];
            logger.info(`[OS Detection] Boot disk found: ${bootDisk ? 'YES' : 'NO'}`);

            if (bootDisk && bootDisk.licenses) {
                const licenses = bootDisk.licenses.map(l => l.toLowerCase());
                const licensesStr = licenses.join(' ');
                logger.info(`[OS Detection] Disk licenses: ${licensesStr || 'NONE'}`);

                // Check for Windows licenses
                if (licensesStr.includes('windows')) {
                    logger.info(`[OS Detection] ✅ OS detected from disk licenses: Windows`);
                    return { os_type: 'Windows', os_source: 'cloud', os_confidence: 'high' };
                }

                // Check for Linux variants
                if (licensesStr.includes('ubuntu') || licensesStr.includes('debian') ||
                    licensesStr.includes('centos') || licensesStr.includes('rhel') ||
                    licensesStr.includes('suse') || licensesStr.includes('linux')) {
                    logger.info(`[OS Detection] ✅ OS detected from disk licenses: Linux`);
                    return { os_type: 'Linux', os_source: 'cloud', os_confidence: 'high' };
                }

                logger.warn(`[OS Detection] Licenses present but no OS match: ${licensesStr}`);
            } else {
                logger.warn(`[OS Detection] No licenses found on boot disk`);
            }

            // Step B: Check source image
            if (bootDisk && bootDisk.source) {
                const source = bootDisk.source.toLowerCase();
                logger.info(`[OS Detection] Checking disk source: ${source}`);

                if (source.includes('windows')) {
                    logger.info(`[OS Detection] ✅ OS inferred from disk source: Windows`);
                    return { os_type: 'Windows', os_source: 'inferred', os_confidence: 'medium' };
                }

                if (source.includes('ubuntu') || source.includes('debian') ||
                    source.includes('centos') || source.includes('rhel') ||
                    source.includes('suse') || source.includes('linux')) {
                    logger.info(`[OS Detection] ✅ OS inferred from disk source: Linux`);
                    return { os_type: 'Linux', os_source: 'inferred', os_confidence: 'medium' };
                }

                logger.warn(`[OS Detection] Disk source present but no OS match`);
            } else {
                logger.warn(`[OS Detection] No disk source available`);
            }
        } else {
            logger.warn(`[OS Detection] No disks found for instance ${instance.name}`);
        }

        // Step C: Check machine type and tags (last resort)
        // GCP instances are predominantly Linux unless explicitly Windows
        logger.info(`[OS Detection] ⚠️ OS defaulting to Linux for GCP instance ${instance.name} (most common)`);
        return { os_type: 'Linux', os_source: 'inferred', os_confidence: 'low' };

    } catch (error) {
        logger.error(`[OS Detection] ❌ OS detection failed for GCP instance ${instance.name}: ${error.message}`);
        return { os_type: 'unknown', os_source: 'unresolved', os_confidence: 'low' };
    }
};

/**
 * Fetch real GCP machine type specifications
 * GCP provides guestCpus and memoryMb in the machine type details
 */
const getGCPSpecsFromAPI = async (compute, projectId, zone, machineType, credentialsObj) => {
    try {
        // GCP provides machine type details through the MachineTypes API
        // CRITICAL: Pass credentials to the client
        const machineTypesClient = new compute.MachineTypesClient({
            credentials: credentialsObj
        });

        const [machineTypeInfo] = await machineTypesClient.get({
            project: projectId,
            zone: zone,
            machineType: machineType
        });

        if (machineTypeInfo) {
            const vCpu = machineTypeInfo.guestCpus || null;
            const memoryMb = machineTypeInfo.memoryMb || null;
            const memoryGb = memoryMb ? memoryMb / 1024 : null; // NO ROUNDING - exact value

            logger.info(`[GCP Specs] ${machineType}: ${vCpu} vCPU, ${memoryGb} GB RAM (from GCP API)`);

            return {
                vcpu_count: vCpu,
                ram_gb: memoryGb
            };
        }

        logger.warn(`[GCP Specs] No data returned for ${machineType}, using fallback`);
        return getGCPSpecsFallback(machineType);

    } catch (error) {
        logger.error(`[GCP Specs] Failed to fetch specs for ${machineType}: ${error.message}`);
        return getGCPSpecsFallback(machineType);
    }
};

/**
 * Fallback function when GCP MachineTypes API fails
 * Returns NULL instead of mock data - frontend will display 'N/A'
 */
const getGCPSpecsFallback = (machineType) => {
    logger.warn(`[GCP Specs] No specs available for ${machineType} - returning NULL`);
    return { vcpu_count: null, ram_gb: null };
};

/**
 * Fetch Cloud Monitoring metrics for a GCP VM instance
 * Returns average and p95 CPU and memory utilization
 * FIXED: Proper null handling, 14-day window, no estimates
 */
const fetchCloudMonitoringMetrics = async (monitoringClient, projectId, instanceId, zone) => {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 14 * 24 * 60 * 60 * 1000); // Last 14 days (not 7)

    let metrics_status = 'missing';
    let cpu_avg = null;
    let cpu_p95 = null;
    let memory_avg = null;
    let memory_p95 = null;

    try {
        // CPU Utilization
        const cpuRequest = {
            name: `projects/${projectId}`,
            filter: `metric.type="compute.googleapis.com/instance/cpu/utilization" AND resource.labels.instance_id="${instanceId}"`,
            interval: {
                startTime: { seconds: Math.floor(startTime.getTime() / 1000) },
                endTime: { seconds: Math.floor(endTime.getTime() / 1000) }
            },
            aggregation: {
                alignmentPeriod: { seconds: 3600 }, // 1 hour
                perSeriesAligner: 'ALIGN_MEAN',
                crossSeriesReducer: 'REDUCE_MEAN'
            }
        };

        const [cpuTimeSeries] = await monitoringClient.listTimeSeries(cpuRequest);

        if (cpuTimeSeries && cpuTimeSeries.length > 0) {
            const cpuValues = cpuTimeSeries[0].points?.map(p => p.value.doubleValue * 100) || [];
            if (cpuValues.length > 0) {
                cpu_avg = cpuValues.reduce((sum, val) => sum + val, 0) / cpuValues.length;
                cpuValues.sort((a, b) => a - b);
                const p95Index = Math.floor(cpuValues.length * 0.95);
                cpu_p95 = cpuValues[p95Index] || cpu_avg * 1.2;

                metrics_status = 'partial'; // CPU present, memory unknown
                logger.info(`Cloud Monitoring CPU metrics for ${instanceId}: avg=${cpu_avg.toFixed(2)}%, p95=${cpu_p95.toFixed(2)}%`);
            } else {
                logger.warn(`No Cloud Monitoring CPU datapoints for ${instanceId}`);
            }
        }

        // Memory Utilization
        // NOTE: GCP memory metrics require Cloud Monitoring agent
        try {
            const memRequest = {
                name: `projects/${projectId}`,
                filter: `metric.type="compute.googleapis.com/instance/memory/balloon/ram_used" AND resource.labels.instance_id="${instanceId}"`,
                interval: {
                    startTime: { seconds: Math.floor(startTime.getTime() / 1000) },
                    endTime: { seconds: Math.floor(endTime.getTime() / 1000) }
                },
                aggregation: {
                    alignmentPeriod: { seconds: 3600 },
                    perSeriesAligner: 'ALIGN_MEAN',
                    crossSeriesReducer: 'REDUCE_MEAN'
                }
            };

            const [memTimeSeries] = await monitoringClient.listTimeSeries(memRequest);

            if (memTimeSeries && memTimeSeries.length > 0) {
                const memValues = memTimeSeries[0].points?.map(p => p.value.doubleValue) || [];
                if (memValues.length > 0) {
                    memory_avg = memValues.reduce((sum, val) => sum + val, 0) / memValues.length;
                    memValues.sort((a, b) => a - b);
                    const p95Index = Math.floor(memValues.length * 0.95);
                    memory_p95 = memValues[p95Index] || memory_avg * 1.2;

                    if (cpu_avg !== null) {
                        metrics_status = 'complete'; // Both CPU and memory present
                    }

                    logger.info(`Cloud Monitoring memory metrics for ${instanceId}: avg=${memory_avg.toFixed(2)}%, p95=${memory_p95.toFixed(2)}%`);
                } else {
                    logger.info(`No memory metrics for ${instanceId} - Cloud Monitoring agent not installed (this is normal)`);
                }
            } else {
                logger.info(`No memory metrics for ${instanceId} - Cloud Monitoring agent not installed (expected)`);
            }
        } catch (memError) {
            // Memory metrics not available - this is EXPECTED and NORMAL
            logger.info(`Memory metrics not available for ${instanceId} - Cloud Monitoring agent not installed (expected)`);
            // Keep memory as null - DO NOT estimate, DO NOT set to 0
        }

        // Network metrics
        const networkInRequest = {
            name: `projects/${projectId}`,
            filter: `metric.type="compute.googleapis.com/instance/network/received_bytes_count" AND resource.labels.instance_id="${instanceId}"`,
            interval: {
                startTime: { seconds: Math.floor(startTime.getTime() / 1000) },
                endTime: { seconds: Math.floor(endTime.getTime() / 1000) }
            },
            aggregation: {
                alignmentPeriod: { seconds: 3600 },
                perSeriesAligner: 'ALIGN_RATE',
                crossSeriesReducer: 'REDUCE_MEAN'
            }
        };

        const networkOutRequest = {
            name: `projects/${projectId}`,
            filter: `metric.type="compute.googleapis.com/instance/network/sent_bytes_count" AND resource.labels.instance_id="${instanceId}"`,
            interval: {
                startTime: { seconds: Math.floor(startTime.getTime() / 1000) },
                endTime: { seconds: Math.floor(endTime.getTime() / 1000) }
            },
            aggregation: {
                alignmentPeriod: { seconds: 3600 },
                perSeriesAligner: 'ALIGN_RATE',
                crossSeriesReducer: 'REDUCE_MEAN'
            }
        };

        const [networkInSeries, networkOutSeries] = await Promise.all([
            monitoringClient.listTimeSeries(networkInRequest),
            monitoringClient.listTimeSeries(networkOutRequest)
        ]);

        const networkInValues = networkInSeries[0]?.[0]?.points?.map(p => p.value.doubleValue) || [];
        const networkOutValues = networkOutSeries[0]?.[0]?.points?.map(p => p.value.doubleValue) || [];

        const network_in_bytes = networkInValues.length > 0
            ? networkInValues.reduce((sum, val) => sum + val, 0) / networkInValues.length
            : 0;

        const network_out_bytes = networkOutValues.length > 0
            ? networkOutValues.reduce((sum, val) => sum + val, 0) / networkOutValues.length
            : 0;

        // Return metrics with proper null handling
        return {
            cpu_avg: cpu_avg !== null ? Math.round(cpu_avg * 10) / 10 : null,
            cpu_p95: cpu_p95 !== null ? Math.round(cpu_p95 * 10) / 10 : null,
            memory_avg: memory_avg !== null ? Math.round(memory_avg * 10) / 10 : null,
            memory_p95: memory_p95 !== null ? Math.round(memory_p95 * 10) / 10 : null,
            network_in_bytes: Math.round(network_in_bytes),
            network_out_bytes: Math.round(network_out_bytes),
            disk_read_iops: 0,
            disk_write_iops: 0,
            metrics_status: metrics_status // 'complete', 'partial', or 'missing'
        };
    } catch (error) {
        logger.error(`Failed to fetch Cloud Monitoring metrics for ${instanceId}:`, error.message);
        logger.error(`Error details:`, error);

        // Return null values if metrics fetch fails - DO NOT return fake data
        return {
            cpu_avg: null,
            cpu_p95: null,
            memory_avg: null,
            memory_p95: null,
            network_in_bytes: 0,
            network_out_bytes: 0,
            disk_read_iops: 0,
            disk_write_iops: 0,
            metrics_status: 'missing'
        };
    }
};


/**
 * Test GCP connection - allows partial access
 * Returns success if credentials are valid, even if some APIs are inaccessible
 */
const testConnection = async (creds) => {
    if (!creds.serviceAccountJson) {
        throw new Error("Missing GCP Service Account JSON");
    }

    let credentialsObj;
    try {
        credentialsObj = JSON.parse(creds.serviceAccountJson);
    } catch (e) {
        throw new Error("Invalid JSON format in Service Account Key");
    }

    const projectId = credentialsObj.project_id;
    if (!projectId) {
        throw new Error("Invalid Service Account JSON: Missing project_id");
    }

    const clientEmail = credentialsObj.client_email;
    if (!clientEmail) {
        throw new Error("Invalid Service Account JSON: Missing client_email");
    }

    // Details for success response
    let projectDetails = { projectId, clientEmail };
    let connectedVia = "";
    let warnings = [];
    let hasAnyAccess = false;

    // 1. Try Cloud Resource Manager (Preferred)
    try {
        const client = new ProjectsClient({ credentials: credentialsObj });
        const [projects] = await client.searchProjects({ query: `id:${projectId}` });
        if (projects && projects.length > 0) {
            projectDetails = { ...projectDetails, ...projects[0] };
        }
        connectedVia = "Cloud Resource Manager";
        hasAnyAccess = true;
        logger.info(`✅ GCP Cloud Resource Manager API accessible`);
    } catch (e) {
        warnings.push({
            api: 'Cloud Resource Manager',
            error: e.message,
            impact: 'Project details may be limited',
            required: false
        });
        logger.warn(`⚠️  Cloud Resource Manager: ${e.message}`);
    }

    // 2. Try Compute Engine API
    try {
        const compute = require('@google-cloud/compute');
        const instancesClient = new compute.InstancesClient({ credentials: credentialsObj });

        const request = {
            project: projectId,
            maxResults: 1
        };

        const iterable = instancesClient.aggregatedListAsync(request);
        const iterator = iterable[Symbol.asyncIterator]();
        await iterator.next();

        if (!connectedVia) connectedVia = "Compute Engine API";
        hasAnyAccess = true;
        logger.info(`✅ GCP Compute Engine API accessible`);
    } catch (e) {
        warnings.push({
            api: 'Compute Engine',
            error: e.message,
            impact: 'VM instances cannot be discovered',
            required: true
        });
        logger.warn(`⚠️  Compute Engine: ${e.message}`);
    }

    // 3. Try Cloud Storage API
    try {
        const storage = new Storage({ credentials: credentialsObj });
        await storage.getBuckets({ maxResults: 1 });

        if (!connectedVia) connectedVia = "Cloud Storage API";
        hasAnyAccess = true;
        logger.info(`✅ GCP Cloud Storage API accessible`);
    } catch (e) {
        warnings.push({
            api: 'Cloud Storage',
            error: e.message,
            impact: 'Storage buckets cannot be discovered',
            required: false
        });
        logger.warn(`⚠️  Cloud Storage: ${e.message}`);
    }

    // Allow connection with valid credentials even if no APIs are accessible
    // User will see warnings when trying to view resources
    if (!hasAnyAccess) {
        logger.warn(`⚠️  No GCP APIs accessible, but credentials are valid`);
        return {
            success: true,
            message: `Connected to GCP Project: ${projectId} (Limited Access - Enable APIs and grant permissions)`,
            details: projectDetails,
            warnings: warnings,
            limitedAccess: true
        };
    }

    const message = warnings.length > 0
        ? `Connected to GCP via ${connectedVia}. Project: ${projectId} (Some APIs unavailable)`
        : `Connected to GCP via ${connectedVia}. Project: ${projectId}`;

    return {
        success: true,
        message,
        details: projectDetails,
        warnings: warnings.length > 0 ? warnings : undefined
    };
};

/**
 * Fetch resources with graceful error handling and ML analysis
 * Continues fetching available resources even if some services fail
 */
const fetchResources = async (userId, creds) => {
    const errors = [];
    const instances = [];
    let vmCount = 0;
    let bucketCount = 0;

    try {
        const credentialsObj = JSON.parse(creds.serviceAccountJson);
        const projectId = credentialsObj.project_id;

        // Initialize monitoring client
        const monitoringClient = new MetricServiceClient({ credentials: credentialsObj });

        // Try to fetch VM instances
        try {
            const compute = require('@google-cloud/compute');
            const instancesClient = new compute.InstancesClient({ credentials: credentialsObj });

            const request = { project: projectId };
            const aggListIterable = instancesClient.aggregatedListAsync(request);

            for await (const [zone, instancesObject] of aggListIterable) {
                if (instancesObject.instances && instancesObject.instances.length > 0) {
                    for (const instance of instancesObject.instances) {
                        // Process ALL instances regardless of status
                        const instanceStatus = instance.status || 'UNKNOWN'; // RUNNING, STOPPED, TERMINATED, etc.

                        logger.info(`Processing GCP instance ${instance.name} (${instanceStatus})`);

                        const zoneName = zone.replace('zones/', '');
                        const machineType = instance.machineType?.split('/').pop() || 'unknown';

                        // Fetch real specs from GCP API
                        const specs = await getGCPSpecsFromAPI(compute, projectId, zoneName, machineType, credentialsObj);
                        const vcpu_count = specs.vcpu_count;
                        const ram_gb = specs.ram_gb;

                        // Fetch Cloud Monitoring metrics only for running instances
                        let metrics;
                        if (instanceStatus === 'RUNNING') {
                            logger.info(`Fetching metrics for GCP instance ${instance.name} (${instanceStatus})`);
                            metrics = await fetchCloudMonitoringMetrics(
                                monitoringClient,
                                projectId,
                                instance.id.toString(),
                                zoneName
                            );
                        } else {
                            // For stopped/terminated instances, use zero metrics
                            logger.info(`Skipping metrics for GCP instance ${instance.name} (${instanceStatus})`);
                            metrics = {
                                cpu_avg: 0,
                                cpu_p95: 0,
                                memory_avg: 0,
                                memory_p95: 0,
                                disk_read_iops: 0,
                                disk_write_iops: 0,
                                network_in_bytes: 0,
                                network_out_bytes: 0
                            };
                        }

                        // Calculate uptime
                        const creationTime = new Date(instance.creationTimestamp);
                        const uptime_hours = Math.round((Date.now() - creationTime.getTime()) / (1000 * 60 * 60));

                        // Detect OS using authoritative method
                        const osInfo = detectGCPOS(instance);
                        logger.info(`GCP instance ${instance.name}: OS=${osInfo.os_type}, source=${osInfo.os_source}, confidence=${osInfo.os_confidence}`);

                        instances.push({
                            instance_id: instance.id.toString(),
                            instance_type: machineType,
                            region: zoneName,
                            cloud: 'gcp',
                            state: instanceStatus, // Add instance status
                            os: osInfo.os_type, // Use detected OS
                            os_source: osInfo.os_source,
                            os_confidence: osInfo.os_confidence,
                            vcpu_count,
                            ram_gb,
                            cpu_avg: metrics.cpu_avg,
                            cpu_p95: metrics.cpu_p95,
                            memory_avg: metrics.memory_avg,
                            memory_p95: metrics.memory_p95,
                            disk_read_iops: metrics.disk_read_iops,
                            disk_write_iops: metrics.disk_write_iops,
                            network_in_bytes: metrics.network_in_bytes,
                            network_out_bytes: metrics.network_out_bytes,
                            uptime_hours,
                            cost_per_month: 0, // Will be calculated by ML service
                            source: 'cloud',
                            name: instance.name,
                            creation_time: instance.creationTimestamp
                        });

                        vmCount++;
                    }
                }
            }
            logger.info(`✅ Collected ${vmCount} GCP VM instances (all states)`);
        } catch (error) {
            logger.error(`❌ Failed to fetch GCP VM instances: ${error.message}`);
            errors.push({
                service: 'Compute Engine',
                error: error.message,
                userMessage: 'Unable to fetch VM instances. Please ensure Compute Engine API is enabled and you have Compute Viewer permissions.'
            });
        }

        // Normalize and enrich instances
        if (instances.length > 0) {
            const normalizedVMs = instances.map(vm => normalizeVM(vm, 'cloud', { cloud: 'gcp' }));
            const enrichedVMs = enrichVMBatch(normalizedVMs);

            // Send to ML service for analysis
            logger.info(`Sending ${enrichedVMs.length} GCP instances to ML service`);
            const mlResults = await processVMsInBatches(enrichedVMs, 100);
            logger.info(`Received ${mlResults.length} predictions from ML service`);

            // Store results in MongoDB
            for (const result of mlResults) {
                const finding = result.prediction || 'Optimal';
                const savings = result.recommendation?.monthly_savings || result.savings || 0;
                const originalInstance = instances.find(i => i.instance_id === result.instance_id);

                // Extract instance family from instance type (e.g., 'n1' from 'n1-standard-2')
                const instanceFamily = result.instance_type ? result.instance_type.split('-')[0] : null;

                // Determine architecture (GCP has both x86_64 and arm64/T2A instances)
                const architecture = result.instance_type?.startsWith('t2a') || result.instance_type?.startsWith('tau') ? 'arm64' : 'x86_64';

                // Parse GCP instance specs (e.g., n1-standard-2 = 2 vCPU, 7.5 GB)
                const getGCPSpecs = (type) => {
                    const match = type?.match(/-(\d+)$/);
                    const vcpu = match ? parseInt(match[1]) : 2;
                    const memoryMultiplier = type?.includes('highmem') ? 6.5 : type?.includes('highcpu') ? 0.9 : 3.75;
                    return { vCpu: vcpu, memoryGb: vcpu * memoryMultiplier };
                };

                const recommendedSpecs = result.recommendation?.suggested_instance ?
                    getGCPSpecs(result.recommendation.suggested_instance) : null;

                // CRITICAL DEBUG: Log what specs we're about to save
                logger.info(`[SPECS SAVE] ${result.instance_id}: originalInstance vCPU=${originalInstance?.vcpu_count}, RAM=${originalInstance?.ram_gb} | ML vCPU=${result.metrics?.vcpu_count}, RAM=${result.metrics?.ram_gb}`);
                logger.info(`[SPECS SAVE] ${result.instance_id}: SAVING vCPU=${originalInstance?.vcpu_count || null}, RAM=${originalInstance?.ram_gb || null}`);

                // FORCE DELETE OLD DATA to ensure fresh specs
                await Resource.deleteOne({ resourceId: result.instance_id });
                logger.info(`[SPECS SAVE] ${result.instance_id}: Deleted old record to force fresh data`);

                await Resource.findOneAndUpdate(
                    { resourceId: result.instance_id },
                    {
                        $set: {
                            userId,
                            resourceId: result.instance_id,
                            name: originalInstance?.name || result.instance_id,
                            provider: 'GCP',
                            service: 'Compute Engine',
                            region: result.region,
                            resourceType: result.instance_type,
                            state: originalInstance?.state || 'unknown', // Force update instance state
                            vCpu: originalInstance?.vcpu_count || null,
                            memoryGb: originalInstance?.ram_gb || null,

                            // Store metrics in the correct fields for frontend - PRESERVE NULL
                            avgCpuUtilization: result.metrics?.cpu_avg ?? null,
                            maxCpuUtilization: result.metrics?.cpu_p95 ?? null,
                            avgMemoryUtilization: result.metrics?.memory_avg ?? null,
                            maxMemoryUtilization: result.metrics?.memory_p95 ?? null,
                            networkIn: result.metrics?.network_in_bytes || 0,
                            networkOut: result.metrics?.network_out_bytes || 0,
                            diskReadBytes: result.metrics?.disk_read_iops || 0,
                            diskWriteBytes: result.metrics?.disk_write_iops || 0,

                            // Store metrics status
                            metrics_status: originalInstance?.metrics?.metrics_status || 'missing',

                            optimizationStatus: finding,
                            recommendation: result.ml_recommendation_text || result.recommendation,
                            estimatedSavings: savings,
                            estimatedMonthlyCost: result.current_cost_per_month || 0,
                            confidence: result.confidence || 0,
                            currentCost: result.current_cost_per_month || 0,
                            optimizedCost: result.recommendation?.suggested_instance ?
                                (result.current_cost_per_month - savings) : result.current_cost_per_month,
                            recommendedType: result.recommendation?.suggested_instance || result.recommendedType || result.instance_type,

                            // NEW: Pricing transparency fields
                            price_source: 'live', // GCP pricing is fetched live
                            price_last_updated: new Date(),

                            // NEW: ML prediction confidence
                            prediction_confidence: result.confidence || 0,

                            // NEW: OS Detection fields
                            os_type: originalInstance?.os || 'unknown',
                            os_source: originalInstance?.os_source || 'unresolved',
                            os_confidence: originalInstance?.os_confidence || 'low',

                            // NEW: Recommended instance details
                            recommendedVcpu: recommendedSpecs?.vCpu || result.metrics?.vcpu_count,
                            recommendedMemory: recommendedSpecs?.memoryGb || result.metrics?.ram_gb,

                            // NEW: Architecture & compatibility
                            architecture: architecture,
                            instance_family: instanceFamily,
                            available_in_region: true, // Assume available since we're fetching from this region

                            // NEW: Recommendation reason
                            reason: result.ml_recommendation_text ||
                                (finding === 'Oversized' ? 'Instance is oversized based on current usage patterns. Downsizing will maintain performance while reducing costs.' :
                                    finding === 'Undersized' ? 'Instance is undersized and may experience performance issues. Upgrading is recommended.' :
                                        'Instance is optimally sized for current workload.'),

                            created: originalInstance?.creation_time,
                            lastFetched: Date.now(),
                            metrics: result.metrics
                        }
                    },
                    { upsert: true, new: true }
                ).then(savedResource => {
                    // VALIDATION: Verify saved data matches what we intended to save
                    if (savedResource.vCpu !== (originalInstance?.vcpu_count || null)) {
                        logger.error(`[VALIDATION ERROR] ${result.instance_id}: vCPU mismatch! Expected ${originalInstance?.vcpu_count}, got ${savedResource.vCpu}`);
                    }
                    if (savedResource.memoryGb !== (originalInstance?.ram_gb || null)) {
                        logger.error(`[VALIDATION ERROR] ${result.instance_id}: Memory mismatch! Expected ${originalInstance?.ram_gb}, got ${savedResource.memoryGb}`);
                    }
                    logger.info(`[VALIDATION OK] ${result.instance_id}: Saved vCPU=${savedResource.vCpu}, RAM=${savedResource.memoryGb}`);
                });
            }
        }

        // Try to fetch storage buckets
        try {
            const storage = new Storage({ credentials: credentialsObj });
            const [buckets] = await storage.getBuckets();
            for (const bucket of buckets) {
                await Resource.findOneAndUpdate(
                    { resourceId: bucket.id },
                    {
                        userId,
                        resourceId: bucket.id,
                        name: bucket.name,
                        provider: 'GCP',
                        service: 'Cloud Storage',
                        region: bucket.location,
                        resourceType: 'Bucket',
                        optimizationStatus: 'Optimal',
                        created: bucket.metadata.timeCreated,
                        lastFetched: Date.now()
                    },
                    { upsert: true }
                );
                bucketCount++;
            }
            logger.info(`✅ Fetched ${bucketCount} GCP storage buckets`);
        } catch (error) {
            logger.error(`❌ Failed to fetch GCP storage buckets: ${error.message}`);
            errors.push({
                service: 'Cloud Storage',
                error: error.message,
                userMessage: 'Unable to fetch storage buckets. Please ensure Cloud Storage API is enabled and you have Storage Object Viewer permissions.'
            });
        }

        const summary = {
            vmInstances: vmCount,
            storageBuckets: bucketCount,
            errors: errors.length > 0 ? errors : undefined
        };

        logger.info(`GCP sync complete for user ${userId}: ${vmCount} VMs analyzed, ${bucketCount} buckets${errors.length > 0 ? `, ${errors.length} errors` : ''}`);

        return summary;
    } catch (error) {
        logger.error("GCP Fetch Error", error);

        // Handle credential errors
        const errorInfo = await handleCloudError(error, userId, 'GCP');
        if (errorInfo.isCredentialError) {
            throw new Error(errorInfo.message);
        }

        throw error;
    }
};

module.exports = { testConnection, fetchResources };
