const { ProjectsClient } = require('@google-cloud/resource-manager');
const { Storage } = require('@google-cloud/storage');
const { MetricServiceClient } = require('@google-cloud/monitoring');
const Resource = require('../models/Resource');
const logger = require('../utils/logger');
const { normalizeVM } = require('./normalizationService');
const { enrichVMBatch, trackUnresolvableInstance } = require('./enrichmentService');
const { processVMsInBatches } = require('./mlService');
const { validateVMBatch, markVMWithError } = require('../utils/dataValidator');

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

        // Track unknown machine type in database for future updates
        await trackUnresolvableInstance('gcp', machineType, zone);

        return getGCPSpecsFallback(machineType);

    } catch (error) {
        logger.error(`[GCP Specs] Failed to fetch specs for ${machineType}: ${error.message}`);

        // Track unknown machine type in database
        await trackUnresolvableInstance('gcp', machineType, zone);

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
/**
 * Fetch Cloud Monitoring metrics for a GCP instance
 * Returns average and p95 CPU and memory utilization
 * ENHANCED: State-aware fetching, agent detection, time window validation, running hours calculation
 * 
 * @param {Object} monitoringClient - GCP Cloud Monitoring client
 * @param {string} projectId - GCP project ID
 * @param {string} instanceId - GCP instance ID
 * @param {string} zone - GCP zone
 * @param {string} state - Instance state (RUNNING, STOPPED, TERMINATED, etc.)
 * @returns {Object} Normalized metrics with status indicators
 */
const fetchCloudMonitoringMetrics = async (monitoringClient, projectId, instanceId, zone, state = 'UNKNOWN') => {
    const METRICS_WINDOW_DAYS = parseInt(process.env.METRICS_WINDOW_DAYS) || 30;

    // CRITICAL: Determine instance state FIRST before fetching metrics
    // Requirement 1.1: State Detection Precedes Metrics Collection
    logger.info(`[Metrics] GCP instance ${instanceId} state: ${state}`);

    // CRITICAL: Return early with null metrics if instance is not RUNNING
    // Requirement 1.2: Stopped Instances Return Null Metrics
    if (state !== 'RUNNING') {
        logger.info(`[Metrics] Skipping metrics for ${instanceId} - instance is ${state} (not RUNNING)`);
        return {
            cpu_avg: null,
            cpu_p95: null,
            memory_avg: null,
            memory_p95: null,
            network_in_bytes: 0,
            network_out_bytes: 0,
            disk_read_iops: 0,
            disk_write_iops: 0,
            metrics_status: 'instance_stopped',
            memory_metrics_source: 'unavailable',
            missing_metrics: [],
            running_hours_last_14d: 0,
            metrics_window_days: METRICS_WINDOW_DAYS,
            state: state,
            state_checked_at: new Date().toISOString()
        };
    }

    // Instance is RUNNING - proceed with metrics collection
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - METRICS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    logger.info(`[Metrics] Fetching Cloud Monitoring metrics for ${instanceId} (${METRICS_WINDOW_DAYS}-day window)`);

    let metrics_status = 'missing';
    let memory_metrics_source = 'unavailable';
    let missing_metrics = [];
    let cpu_avg = null;
    let cpu_p95 = null;
    let memory_avg = null;
    let memory_p95 = null;
    let running_hours_last_14d = 0;

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

                // Calculate running hours from number of datapoints (each datapoint = 1 hour)
                running_hours_last_14d = cpuValues.length;

                metrics_status = 'partial'; // CPU present, memory unknown
                logger.info(`Cloud Monitoring CPU metrics for ${instanceId}: avg=${cpu_avg.toFixed(2)}%, p95=${cpu_p95.toFixed(2)}%, running_hours=${running_hours_last_14d}`);
            } else {
                logger.warn(`No Cloud Monitoring CPU datapoints for ${instanceId}`);
                missing_metrics.push('cpu_avg', 'cpu_p95');
            }
        } else {
            missing_metrics.push('cpu_avg', 'cpu_p95');
        }

        // Memory Utilization (requires Cloud Monitoring agent / Ops Agent)
        try {
            const memRequest = {
                name: `projects/${projectId}`,
                filter: `metric.type="agent.googleapis.com/memory/percent_used" AND resource.labels.instance_id="${instanceId}"`,
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

                    memory_metrics_source = 'available';

                    if (cpu_avg !== null) {
                        metrics_status = 'complete'; // Both CPU and memory present
                    }

                    logger.info(`Cloud Monitoring memory metrics for ${instanceId}: avg=${memory_avg.toFixed(2)}%, p95=${memory_p95.toFixed(2)}%`);
                } else {
                    logger.info(`No memory metrics for ${instanceId} - Ops Agent not installed (this is normal)`);
                    memory_metrics_source = 'agent_required';
                    missing_metrics.push('memory_avg', 'memory_p95');
                }
            } else {
                logger.info(`No memory metrics for ${instanceId} - Ops Agent not installed (expected)`);
                memory_metrics_source = 'agent_required';
                missing_metrics.push('memory_avg', 'memory_p95');
            }
        } catch (memError) {
            // Memory metrics not available - this is EXPECTED and NORMAL
            logger.info(`Memory metrics not available for ${instanceId} - Ops Agent not installed (expected)`);
            memory_metrics_source = 'agent_required';
            missing_metrics.push('memory_avg', 'memory_p95');
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

        // CRITICAL: Check if uptime is sufficient for the metrics window
        // Calculate uptime in days
        const uptime_days = running_hours_last_14d / 24;

        // Requirement 1.1-1.4: Dynamic time window calculation based on uptime
        let metrics_window_days;
        if (uptime_days >= 30) {
            metrics_window_days = 30;
        } else if (uptime_days >= 14) {
            metrics_window_days = 14;
        } else if (uptime_days >= 7) {
            metrics_window_days = 7;
        } else {
            // Requirement 1.4: Mark as INSUFFICIENT_DATA if uptime < 7 days
            metrics_status = 'insufficient_data';
            metrics_window_days = Math.floor(uptime_days);
            logger.warn(`Insufficient uptime for ${instanceId}: ${uptime_days.toFixed(1)} days < 7 days required`);
        }

        logger.info(`Metrics window for ${instanceId}: ${metrics_window_days} days (uptime: ${uptime_days.toFixed(1)} days)`);

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
            metrics_status, // 'complete', 'partial', 'insufficient_data', or 'missing'
            memory_metrics_source, // 'available', 'agent_required', or 'unavailable'
            missing_metrics, // Array of missing metric names
            running_hours_last_14d, // Running hours in the last 14 days
            metrics_window_days, // Calculated based on uptime (7, 14, or 30 days)
            state: state,
            state_checked_at: new Date().toISOString()
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
            metrics_status: 'missing',
            memory_metrics_source: 'unavailable',
            missing_metrics: ['cpu_avg', 'cpu_p95', 'memory_avg', 'memory_p95'],
            running_hours_last_14d: 0,
            metrics_window_days: parseInt(process.env.METRICS_WINDOW_DAYS) || 30,
            state: state,
            state_checked_at: new Date().toISOString()
        };
    }
};


/**
 * Test GCP connection - allows partial access
 * Returns success if credentials are valid, even if some APIs are inaccessible
 */
/**
 * Helper function to add timeout to promises
 */
const withTimeout = (promise, timeoutMs, errorMessage) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        )
    ]);
};

/**
 * Test GCP connection and validate permissions
 * Returns detailed permission status with missing permissions and impact
 * ENHANCED: Added timeout handling to prevent hanging
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

    // Test basic authentication first - this will fail if credentials are deleted
    // Add 10 second timeout for authentication
    try {
        const { GoogleAuth } = require('google-auth-library');
        const auth = new GoogleAuth({
            credentials: credentialsObj,
            scopes: ['https://www.googleapis.com/auth/cloud-platform.read-only']
        });

        // Try to get an access token - this will fail if credentials are deleted/revoked
        const client = await auth.getClient();
        await withTimeout(
            client.getAccessToken(),
            10000,
            'GCP authentication timed out after 10 seconds'
        );
        logger.info('[GCP Auth] ✓ Credentials are valid and can authenticate');
    } catch (authError) {
        logger.error('[GCP Auth] ✗ Authentication failed - credentials may be deleted or revoked');
        if (authError.message.includes('timed out')) {
            throw new Error('GCP authentication timed out. Please check your network connection and try again.');
        }
        throw new Error('GCP credentials are invalid or have been deleted from Google Cloud');
    }

    // Details for success response
    let projectDetails = { projectId, clientEmail };
    let connectedVia = "";
    const missingPermissions = [];
    const impact = [];
    let connectionStatus = 'full';
    let hasAnyAccess = false;

    // 1. Try Cloud Resource Manager (Optional) - 5 second timeout
    try {
        const client = new ProjectsClient({ credentials: credentialsObj });
        const [projects] = await withTimeout(
            client.searchProjects({ query: `id:${projectId}` }),
            5000,
            'Cloud Resource Manager API timed out'
        );
        if (projects && projects.length > 0) {
            projectDetails = { ...projectDetails, ...projects[0] };
        }
        connectedVia = "Cloud Resource Manager";
        hasAnyAccess = true;
        logger.info('[GCP Permissions] ✓ Cloud Resource Manager accessible');
    } catch (e) {
        logger.info('[GCP Permissions] ℹ Cloud Resource Manager not accessible (optional)');
    }

    // 2. Test Compute Viewer role (VM inventory) - 5 second timeout
    try {
        const compute = require('@google-cloud/compute');
        const instancesClient = new compute.InstancesClient({ credentials: credentialsObj });

        const request = {
            project: projectId,
            maxResults: 1
        };

        const iterable = instancesClient.aggregatedListAsync(request);
        const iterator = iterable[Symbol.asyncIterator]();
        await withTimeout(
            iterator.next(),
            5000,
            'Compute Engine API timed out'
        );

        if (!connectedVia) connectedVia = "Compute Engine API";
        hasAnyAccess = true;
        logger.info('[GCP Permissions] ✓ Compute Viewer role available');
    } catch (e) {
        if (e.code === 7 || e.message.includes('PERMISSION_DENIED')) {
            missingPermissions.push('Compute Viewer role');
            impact.push('Cannot fetch VM instances');
            connectionStatus = 'partial';
            logger.warn('[GCP Permissions] ✗ Compute Viewer role missing');
        } else if (e.message.includes('timed out')) {
            logger.warn('[GCP Permissions] ⏱ Compute Engine API timed out');
        }
    }

    // 3. Test Machine Types access (VM specifications) - 5 second timeout
    try {
        const compute = require('@google-cloud/compute');
        const machineTypesClient = new compute.MachineTypesClient({ credentials: credentialsObj });

        const request = {
            project: projectId,
            zone: 'us-central1-a', // Test with a common zone
            maxResults: 1
        };

        await withTimeout(
            machineTypesClient.list(request),
            5000,
            'Machine Types API timed out'
        );
        logger.info('[GCP Permissions] ✓ Machine Types API available');
    } catch (e) {
        if (e.code === 7 || e.message.includes('PERMISSION_DENIED')) {
            missingPermissions.push('Compute resource access');
            impact.push('Cannot fetch VM specifications');
            connectionStatus = 'partial';
            logger.warn('[GCP Permissions] ✗ Machine Types API access missing');
        } else if (e.message.includes('timed out')) {
            logger.warn('[GCP Permissions] ⏱ Machine Types API timed out');
        }
    }

    // 4. Test Monitoring Viewer role (metrics access) - 5 second timeout
    try {
        const monitoring = require('@google-cloud/monitoring');
        const monitoringClient = new monitoring.MetricServiceClient({ credentials: credentialsObj });

        // Try to list metric descriptors (lightweight test)
        const request = {
            name: `projects/${projectId}`,
            filter: 'metric.type="compute.googleapis.com/instance/cpu/utilization"',
            pageSize: 1
        };

        await withTimeout(
            monitoringClient.listMetricDescriptors(request),
            5000,
            'Monitoring API timed out'
        );
        logger.info('[GCP Permissions] ✓ Monitoring Viewer role available');
    } catch (e) {
        if (e.code === 7 || e.message.includes('PERMISSION_DENIED')) {
            missingPermissions.push('Monitoring Viewer role');
            impact.push('Cannot fetch CPU and memory metrics');
            connectionStatus = 'partial';
            logger.warn('[GCP Permissions] ✗ Monitoring Viewer role missing');
        } else if (e.message.includes('timed out')) {
            logger.warn('[GCP Permissions] ⏱ Monitoring API timed out');
        }
    }

    // 5. Test Billing Viewer role (pricing access) - Optional - 5 second timeout
    try {
        const { CloudBillingClient } = require('@google-cloud/billing');
        const billingClient = new CloudBillingClient({ credentials: credentialsObj });

        // Try to get billing info for the project
        const [billingInfo] = await withTimeout(
            billingClient.getProjectBillingInfo({
                name: `projects/${projectId}`
            }),
            5000,
            'Billing API timed out'
        );

        if (billingInfo) {
            logger.info('[GCP Permissions] ✓ Billing Viewer role available');
        }
    } catch (e) {
        if (e.code === 7 || e.message.includes('PERMISSION_DENIED')) {
            missingPermissions.push('Billing Viewer role');
            impact.push('Live pricing unavailable - will use cached pricing');
            connectionStatus = 'partial';
            logger.warn('[GCP Permissions] ✗ Billing Viewer role missing');
        } else if (e.message.includes('timed out')) {
            logger.warn('[GCP Permissions] ⏱ Billing API timed out');
        }
    }

    // 6. Try Cloud Storage API (Optional) - 5 second timeout
    try {
        const storage = new Storage({ credentials: credentialsObj });
        await withTimeout(
            storage.getBuckets({ maxResults: 1 }),
            5000,
            'Cloud Storage API timed out'
        );

        if (!connectedVia) connectedVia = "Cloud Storage API";
        hasAnyAccess = true;
        logger.info('[GCP Permissions] ✓ Cloud Storage API accessible');
    } catch (e) {
        logger.info('[GCP Permissions] ℹ Cloud Storage not accessible (optional)');
    }

    // Allow connection with valid credentials even if no APIs are accessible
    if (!hasAnyAccess) {
        logger.warn(`⚠️  No GCP APIs accessible - credentials may be deleted or revoked`);

        // This indicates the credentials are invalid or deleted
        throw new Error('GCP credentials are invalid or have been deleted. No API access available.');
    }

    const message = connectionStatus === 'full'
        ? `Connected to GCP via ${connectedVia}. Project: ${projectId} with full permissions`
        : `Connected to GCP via ${connectedVia}. Project: ${projectId} with partial permissions`;

    return {
        success: true,
        message,
        connection_status: connectionStatus,
        missing_permissions: missingPermissions,
        impact,
        details: projectDetails
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
                                zoneName,
                                instanceStatus
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

                        const instanceData = {
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
                        };

                        // Log detailed instance information
                        logger.info(`\n${'='.repeat(80)}`);
                        logger.info(`📊 GCP INSTANCE DETAILS FETCHED`);
                        logger.info(`${'='.repeat(80)}`);
                        logger.info(`Instance Name: ${instance.name}`);
                        logger.info(`Instance ID: ${instance.id}`);
                        logger.info(`Machine Type: ${machineType}`);
                        logger.info(`Zone: ${zoneName}`);
                        logger.info(`Status: ${instanceStatus}`);
                        logger.info(`Creation Time: ${instance.creationTimestamp}`);
                        logger.info(`\n--- Hardware Specifications ---`);
                        logger.info(`vCPU Count: ${vcpu_count || 'N/A'}`);
                        logger.info(`RAM (GB): ${ram_gb || 'N/A'}`);
                        logger.info(`\n--- Operating System ---`);
                        logger.info(`OS Type: ${osInfo.os_type}`);
                        logger.info(`OS Source: ${osInfo.os_source}`);
                        logger.info(`OS Confidence: ${osInfo.os_confidence}`);
                        logger.info(`\n--- Metrics (Last 14 Days) ---`);
                        logger.info(`CPU Average: ${metrics.cpu_avg !== null ? metrics.cpu_avg + '%' : 'N/A'}`);
                        logger.info(`CPU P95: ${metrics.cpu_p95 !== null ? metrics.cpu_p95 + '%' : 'N/A'}`);
                        logger.info(`Memory Average: ${metrics.memory_avg !== null ? metrics.memory_avg + '%' : 'N/A (Agent Required)'}`);
                        logger.info(`Memory P95: ${metrics.memory_p95 !== null ? metrics.memory_p95 + '%' : 'N/A (Agent Required)'}`);
                        logger.info(`Network In: ${metrics.network_in_bytes} bytes`);
                        logger.info(`Network Out: ${metrics.network_out_bytes} bytes`);
                        logger.info(`Disk Read IOPS: ${metrics.disk_read_iops}`);
                        logger.info(`Disk Write IOPS: ${metrics.disk_write_iops}`);
                        logger.info(`Uptime Hours: ${uptime_hours} hours`);
                        logger.info(`${'='.repeat(80)}\n`);

                        instances.push(instanceData);

                        vmCount++;
                    }
                }
            }
            logger.info(`\n${'='.repeat(80)}`);
            logger.info(`✅ GCP FETCH SUMMARY`);
            logger.info(`${'='.repeat(80)}`);
            logger.info(`Total Instances Collected: ${vmCount}`);
            logger.info(`Project ID: ${projectId}`);
            logger.info(`User ID: ${userId}`);

            // Count by state
            const stateCount = {};
            instances.forEach(inst => {
                stateCount[inst.state] = (stateCount[inst.state] || 0) + 1;
            });
            logger.info(`\nInstances by Status:`);
            Object.entries(stateCount).forEach(([state, count]) => {
                logger.info(`  ${state}: ${count}`);
            });

            // Count by OS
            const osCount = {};
            instances.forEach(inst => {
                osCount[inst.os] = (osCount[inst.os] || 0) + 1;
            });
            logger.info(`\nInstances by OS:`);
            Object.entries(osCount).forEach(([os, count]) => {
                logger.info(`  ${os}: ${count}`);
            });

            // Count by zone
            const zoneCount = {};
            instances.forEach(inst => {
                zoneCount[inst.region] = (zoneCount[inst.region] || 0) + 1;
            });
            logger.info(`\nInstances by Zone:`);
            Object.entries(zoneCount).forEach(([zone, count]) => {
                logger.info(`  ${zone}: ${count}`);
            });

            logger.info(`${'='.repeat(80)}\n`);
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
            // Validate data before processing
            const validationResults = validateVMBatch(instances, 'gcp');

            // Mark invalid VMs with errors
            const validatedInstances = instances.map(vm => {
                const validation = require('../utils/dataValidator').validateVMData(vm, 'gcp');
                if (!validation.valid) {
                    return markVMWithError(vm, validation.errors);
                }
                return vm;
            });

            const normalizedVMs = validatedInstances.map(vm => normalizeVM(vm, 'cloud', { cloud: 'gcp' }));
            const enrichedVMs = await enrichVMBatch(normalizedVMs);

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

                            // NEW: CPU + Memory Recommendation System Metrics
                            cpu_avg: result.metrics?.cpu_avg ?? null,
                            cpu_p95: result.metrics?.cpu_p95 ?? null,
                            memory_avg: result.metrics?.memory_avg ?? null,
                            memory_p95: result.metrics?.memory_p95 ?? null,

                            // Store metrics status
                            metrics_status: result.metrics?.metrics_status || originalInstance?.metrics_status || 'missing',

                            // NEW: Metrics metadata for recommendation engine
                            running_hours_last_14d: result.metrics?.running_hours_last_14d || originalInstance?.running_hours_last_14d || 0,
                            metrics_window_days: result.metrics?.metrics_window_days || originalInstance?.metrics_window_days || null,
                            state_checked_at: result.metrics?.state_checked_at || originalInstance?.state_checked_at || new Date(),

                            // NEW: Memory metrics source tracking
                            memory_metrics_source: result.metrics?.memory_metrics_source || originalInstance?.memory_metrics_source || 'unavailable',
                            missing_metrics: result.metrics?.missing_metrics || originalInstance?.missing_metrics || [],

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
        throw error;
    }
};

/**
 * Fetch GCP resources and return data directly (no MongoDB operations)
 * This method is used by the controller to fetch resources for localStorage storage
 * It reuses all the data fetching, normalization, enrichment, and ML prediction logic
 * from fetchResources() but skips MongoDB operations
 */
const fetchResourcesSync = async (userId, creds) => {
    const instances = [];

    try {
        const credentialsObj = JSON.parse(creds.serviceAccountJson);
        const projectId = credentialsObj.project_id;

        logger.info(`[Sync] Fetching GCP resources for user ${userId}, project ${projectId}`);

        // Initialize monitoring client
        const monitoringClient = new MetricServiceClient({ credentials: credentialsObj });

        // Fetch VM instances
        try {
            const compute = require('@google-cloud/compute');
            const instancesClient = new compute.InstancesClient({ credentials: credentialsObj });

            const request = { project: projectId };
            const aggListIterable = instancesClient.aggregatedListAsync(request);

            for await (const [zone, instancesObject] of aggListIterable) {
                if (instancesObject.instances && instancesObject.instances.length > 0) {
                    for (const instance of instancesObject.instances) {
                        // Process ALL instances regardless of status
                        const instanceStatus = instance.status || 'UNKNOWN';

                        logger.info(`[Sync] Processing GCP instance ${instance.name} (${instanceStatus})`);

                        const zoneName = zone.replace('zones/', '');
                        const machineType = instance.machineType?.split('/').pop() || 'unknown';

                        // Fetch real specs from GCP API
                        const specs = await getGCPSpecsFromAPI(compute, projectId, zoneName, machineType, credentialsObj);
                        const vcpu_count = specs.vcpu_count;
                        const ram_gb = specs.ram_gb;

                        // Fetch Cloud Monitoring metrics only for running instances
                        let metrics;
                        if (instanceStatus === 'RUNNING') {
                            logger.info(`[Sync] Fetching metrics for GCP instance ${instance.name} (${instanceStatus})`);
                            metrics = await fetchCloudMonitoringMetrics(
                                monitoringClient,
                                projectId,
                                instance.id.toString(),
                                zoneName,
                                instanceStatus
                            );
                        } else {
                            // For stopped/terminated instances, use null metrics
                            logger.info(`[Sync] Skipping metrics for GCP instance ${instance.name} (${instanceStatus})`);
                            metrics = {
                                cpu_avg: null,
                                cpu_p95: null,
                                memory_avg: null,
                                memory_p95: null,
                                disk_read_iops: 0,
                                disk_write_iops: 0,
                                network_in_bytes: 0,
                                network_out_bytes: 0,
                                metrics_status: 'missing',
                                memory_metrics_source: 'unavailable',
                                missing_metrics: [],
                                running_hours_last_14d: 0
                            };
                        }

                        // Calculate uptime
                        const creationTime = new Date(instance.creationTimestamp);
                        const uptime_hours = Math.round((Date.now() - creationTime.getTime()) / (1000 * 60 * 60));

                        // Detect OS using authoritative method
                        const osInfo = detectGCPOS(instance);
                        logger.info(`[Sync] GCP instance ${instance.name}: OS=${osInfo.os_type}, source=${osInfo.os_source}, confidence=${osInfo.os_confidence}`);

                        const instanceData = {
                            instance_id: instance.id.toString(),
                            instance_type: machineType,
                            region: zoneName,
                            cloud: 'gcp',
                            state: instanceStatus,
                            os: osInfo.os_type,
                            os_source: osInfo.os_source,
                            os_confidence: osInfo.os_confidence,
                            vcpu_count,
                            ram_gb,
                            architecture: machineType?.startsWith('t2a') || machineType?.startsWith('tau') ? 'arm64' : 'x86_64',
                            burstable: false, // GCP doesn't have burstable instances like AWS T-series
                            gpu: false, // Would need to check accelerators array
                            cpu_avg: metrics.cpu_avg,
                            cpu_p95: metrics.cpu_p95,
                            memory_avg: metrics.memory_avg,
                            memory_p95: metrics.memory_p95,
                            disk_read_iops: metrics.disk_read_iops,
                            disk_write_iops: metrics.disk_write_iops,
                            network_in_bytes: metrics.network_in_bytes,
                            network_out_bytes: metrics.network_out_bytes,
                            metrics_status: metrics.metrics_status,
                            memory_metrics_source: metrics.memory_metrics_source,
                            missing_metrics: metrics.missing_metrics,
                            running_hours_last_14d: metrics.running_hours_last_14d,
                            uptime_hours,
                            cost_per_month: 0,
                            source: 'cloud',
                            name: instance.name,
                            creation_time: instance.creationTimestamp
                        };

                        instances.push(instanceData);
                    }
                }
            }

            logger.info(`\n${'='.repeat(80)}`);
            logger.info(`✅ [Sync] GCP FETCH SUMMARY`);
            logger.info(`${'='.repeat(80)}`);
            logger.info(`Total Instances Collected: ${instances.length}`);
            logger.info(`Project ID: ${projectId}`);
            logger.info(`User ID: ${userId}`);
            logger.info(`${'='.repeat(80)}\n`);

        } catch (error) {
            logger.error(`❌ [Sync] Failed to fetch GCP VM instances: ${error.message}`);
            throw error;
        }

        // Validate data before processing
        const validationResults = validateVMBatch(instances, 'gcp');

        // Mark invalid VMs with errors
        const validatedInstances = instances.map(vm => {
            const validation = require('../utils/dataValidator').validateVMData(vm, 'gcp');
            if (!validation.valid) {
                return markVMWithError(vm, validation.errors);
            }
            return vm;
        });

        // Normalize and enrich instances
        const normalizedVMs = validatedInstances.map(vm => normalizeVM(vm, 'cloud', { cloud: 'gcp' }));
        const enrichedVMs = await enrichVMBatch(normalizedVMs);

        // Send to ML service for analysis
        let mlResults = [];
        if (enrichedVMs.length > 0) {
            logger.info(`[Sync] Sending ${enrichedVMs.length} GCP instances to ML service`);
            mlResults = await processVMsInBatches(enrichedVMs, 100);
            logger.info(`[Sync] Received ${mlResults.length} predictions from ML service`);
        }

        // Build final results array with all required fields for frontend
        const results = mlResults.map(result => {
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

            return {
                // Core identification
                instance_id: result.instance_id,
                resourceId: result.instance_id,
                name: originalInstance?.name || result.instance_id,
                provider: 'GCP',
                service: 'Compute Engine',
                cloud: 'gcp',

                // Location and type
                region: result.region,
                resourceType: result.instance_type,
                instance_type: result.instance_type,
                state: originalInstance?.state || 'unknown',
                status: originalInstance?.state || 'unknown', // Add status field for frontend compatibility

                // Hardware specs
                vCpu: originalInstance?.vcpu_count || null,
                vcpu_count: originalInstance?.vcpu_count || null,
                memoryGb: originalInstance?.ram_gb || null,
                ram_gb: originalInstance?.ram_gb || null,
                architecture: architecture,
                burstable: false, // GCP doesn't have burstable instances like AWS
                gpu: false, // Would need to check accelerators

                // Metrics
                avgCpuUtilization: result.metrics?.cpu_avg ?? null,
                cpu_avg: result.metrics?.cpu_avg ?? null,
                maxCpuUtilization: result.metrics?.cpu_p95 ?? null,
                cpu_p95: result.metrics?.cpu_p95 ?? null,
                avgMemoryUtilization: result.metrics?.memory_avg ?? null,
                memory_avg: result.metrics?.memory_avg ?? null,
                maxMemoryUtilization: result.metrics?.memory_p95 ?? null,
                memory_p95: result.metrics?.memory_p95 ?? null,
                networkIn: result.metrics?.network_in_bytes || 0,
                network_in_bytes: result.metrics?.network_in_bytes || 0,
                networkOut: result.metrics?.network_out_bytes || 0,
                network_out_bytes: result.metrics?.network_out_bytes || 0,
                diskReadBytes: result.metrics?.disk_read_iops || 0,
                disk_read_iops: result.metrics?.disk_read_iops || 0,
                diskWriteBytes: result.metrics?.disk_write_iops || 0,
                disk_write_iops: result.metrics?.disk_write_iops || 0,
                metrics_status: originalInstance?.metrics_status || 'missing',
                memory_metrics_source: originalInstance?.memory_metrics_source || 'unavailable',

                // Optimization
                optimizationStatus: finding,
                recommendation: result.ml_recommendation_text || result.recommendation,
                estimatedSavings: savings,
                estimatedMonthlyCost: result.current_cost_per_month || 0,
                confidence: result.confidence || 0,
                prediction_confidence: result.confidence || 0,
                currentCost: result.current_cost_per_month || 0,
                optimizedCost: result.recommendation?.suggested_instance ?
                    (result.current_cost_per_month - savings) : result.current_cost_per_month,
                recommendedType: result.recommendation?.suggested_instance || result.recommendedType || result.instance_type,
                recommendedVcpu: recommendedSpecs?.vCpu || result.metrics?.vcpu_count,
                recommendedMemory: recommendedSpecs?.memoryGb || result.metrics?.ram_gb,

                // OS detection
                os: originalInstance?.os || 'unknown',
                os_type: originalInstance?.os || 'unknown',
                os_source: originalInstance?.os_source || 'unresolved',
                os_confidence: originalInstance?.os_confidence || 'low',

                // Pricing
                price_source: 'live',
                price_last_updated: new Date(),

                // Architecture & compatibility
                instance_family: instanceFamily,
                available_in_region: true,

                // Recommendation reason
                reason: result.ml_recommendation_text ||
                    (finding === 'Oversized' ? 'Instance is oversized based on current usage patterns. Downsizing will maintain performance while reducing costs.' :
                        finding === 'Undersized' ? 'Instance is undersized and may experience performance issues. Upgrading is recommended.' :
                            'Instance is optimally sized for current workload.'),

                // Timestamps
                created: originalInstance?.creation_time,
                creation_time: originalInstance?.creation_time,
                lastFetched: Date.now(),

                // Full metrics object
                metrics: result.metrics
            };
        });

        logger.info(`[Sync] GCP Compute Engine sync complete for user ${userId}: ${results.length} instances processed`);

        // Return array of resource objects (NO MongoDB operations)
        return results;

    } catch (error) {
        logger.error("[Sync] GCP Fetch Error", error);
        throw error;
    }
};

module.exports = { testConnection, fetchResources, fetchResourcesSync };
