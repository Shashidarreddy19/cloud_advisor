const { ClientSecretCredential } = require("@azure/identity");
const axios = require("axios");
const { ComputeManagementClient } = require("@azure/arm-compute");
const { StorageManagementClient } = require("@azure/arm-storage");
const { MonitorClient } = require("@azure/arm-monitor");
const Resource = require('../models/Resource');
const logger = require('../utils/logger');
const { normalizeVM } = require('./normalizationService');
const { enrichVMBatch, trackUnresolvableInstance } = require('./enrichmentService');
const { processVMsInBatches } = require('./mlService');
const { validateVMBatch, markVMWithError } = require('../utils/dataValidator');

/**
 * Detect OS from Azure VM
 * AUTHORITATIVE METHOD: Uses storageProfile.osDisk.osType
 * Returns: { os_type: 'Linux'|'Windows'|'unknown', os_source: 'cloud'|'inferred'|'unresolved', os_confidence: 'high'|'medium'|'low' }
 */
const detectAzureOS = (vm) => {
    try {
        logger.info(`[OS Detection] Starting for Azure VM ${vm.name}`);

        // Step A: Check storageProfile.osDisk.osType (AUTHORITATIVE)
        const osType = vm.storageProfile?.osDisk?.osType;
        logger.info(`[OS Detection] storageProfile.osDisk.osType: ${osType || 'NOT AVAILABLE'}`);

        if (osType) {
            const normalizedOS = osType.charAt(0).toUpperCase() + osType.slice(1).toLowerCase();

            if (normalizedOS === 'Windows' || normalizedOS === 'Linux') {
                logger.info(`[OS Detection] ✅ OS detected from storageProfile: ${normalizedOS}`);
                return { os_type: normalizedOS, os_source: 'cloud', os_confidence: 'high' };
            }
        } else {
            logger.warn(`[OS Detection] storageProfile.osDisk.osType NOT available for ${vm.name}`);
        }

        // Step B: Fallback to image reference
        const imageRef = vm.storageProfile?.imageReference;
        if (imageRef) {
            const offer = (imageRef.offer || '').toLowerCase();
            const publisher = (imageRef.publisher || '').toLowerCase();
            const sku = (imageRef.sku || '').toLowerCase();
            const combined = offer + ' ' + publisher + ' ' + sku;

            logger.info(`[OS Detection] Checking image reference - Publisher: ${publisher}, Offer: ${offer}, SKU: ${sku}`);

            if (combined.includes('windows') || publisher.includes('microsoft')) {
                logger.info(`[OS Detection] ✅ OS inferred from image reference: Windows`);
                return { os_type: 'Windows', os_source: 'inferred', os_confidence: 'medium' };
            }

            if (combined.includes('linux') || combined.includes('ubuntu') ||
                combined.includes('rhel') || combined.includes('centos') ||
                combined.includes('debian') || combined.includes('suse') ||
                publisher.includes('canonical') || publisher.includes('redhat')) {
                logger.info(`[OS Detection] ✅ OS inferred from image reference: Linux`);
                return { os_type: 'Linux', os_source: 'inferred', os_confidence: 'medium' };
            }

            logger.warn(`[OS Detection] Image reference present but no OS match`);
        } else {
            logger.warn(`[OS Detection] Image reference NOT available`);
        }

        logger.warn(`[OS Detection] ⚠️ OS could not be determined for Azure VM ${vm.name}`);
        return { os_type: 'unknown', os_source: 'unresolved', os_confidence: 'low' };

    } catch (error) {
        logger.error(`[OS Detection] ❌ OS detection failed for Azure VM ${vm.name}: ${error.message}`);
        return { os_type: 'unknown', os_source: 'unresolved', os_confidence: 'low' };
    }
};

/**
 * Fetch real Azure VM specifications from Azure API
 * Returns actual vCPU and memory from Azure, not from lookup table
 * Uses official VirtualMachineSizes.list API
 */
const getAzureVMSpecsFromAPI = async (computeClient, vmSize, location) => {
    try {
        // Use Azure's official VirtualMachineSizes API to get exact specs
        const vmSizes = await computeClient.virtualMachineSizes.list(location);

        // Find the matching VM size
        for await (const size of vmSizes) {
            if (size.name === vmSize) {
                const vCpu = size.numberOfCores || null;
                const memoryMb = size.memoryInMB || null;
                const memoryGb = memoryMb ? memoryMb / 1024 : null; // NO ROUNDING - exact value

                logger.info(`[Azure Specs] ${vmSize}: ${vCpu} vCPU, ${memoryGb} GB RAM (from Azure API)`);

                return {
                    vCpu: vCpu,
                    memoryGb: memoryGb
                };
            }
        }

        logger.warn(`[Azure Specs] VM size ${vmSize} not found in location ${location}, using name parsing fallback`);

        // Track unknown VM size in database for future updates
        await trackUnresolvableInstance('azure', vmSize, location);

        // Fallback to name parsing if API doesn't return the size
        const match = vmSize.match(/[A-Z]+(\d+)/);
        if (match) {
            const vCpuFromName = parseInt(match[1]);

            // Memory calculation based on Azure naming conventions
            let memoryGb = null;
            if (vmSize.includes('_B')) {
                // B-series: varies
                if (vmSize.includes('B1s')) memoryGb = 1;
                else if (vmSize.includes('B1ms')) memoryGb = 2;
                else if (vmSize.includes('B2s')) memoryGb = 4;
                else if (vmSize.includes('B2ms')) memoryGb = 8;
                else if (vmSize.includes('B4ms')) memoryGb = 16;
                else memoryGb = vCpuFromName * 4;
            } else if (vmSize.includes('_D') || vmSize.includes('_E')) {
                // D-series and E-series: 4 GB per vCPU for D, 8 GB per vCPU for E
                memoryGb = vmSize.includes('_E') ? vCpuFromName * 8 : vCpuFromName * 4;
            } else if (vmSize.includes('_F')) {
                // F-series: 2 GB per vCPU
                memoryGb = vCpuFromName * 2;
            } else {
                // Default: 4 GB per vCPU
                memoryGb = vCpuFromName * 4;
            }

            logger.info(`[Azure Specs] ${vmSize}: ${vCpuFromName} vCPU, ${memoryGb} GB RAM (parsed from name)`);

            return {
                vCpu: vCpuFromName,
                memoryGb: memoryGb
            };
        }

        logger.warn(`[Azure Specs] Could not parse ${vmSize}, using fallback`);

        // Track unknown VM size in database
        await trackUnresolvableInstance('azure', vmSize, location);

        return getAzureVMSpecs(vmSize);

    } catch (error) {
        logger.error(`[Azure Specs] Failed to get specs for ${vmSize}: ${error.message}`);

        // Track unknown VM size in database
        await trackUnresolvableInstance('azure', vmSize, location);

        return getAzureVMSpecs(vmSize);
    }
};

/**
 * Parse Azure VM size for specs
 */
const getAzureVMSpecs = (vmSize) => {
    logger.warn(`[Azure Specs] No specs available for ${vmSize} - returning NULL`);
    return { vCpu: null, memoryGb: null };
};


/**
 * Fetch Azure Monitor metrics for a VM
 * Returns average and p95 CPU and memory utilization
 * FIXED: Proper null handling, 14-day window, no estimates
 */
/**
 * Fetch Azure Monitor metrics for a VM
 * Returns average and p95 CPU and memory utilization
 * ENHANCED: State-aware fetching, agent detection, time window validation, running hours calculation
 * 
 * @param {Object} monitorClient - Azure Monitor client
 * @param {string} resourceId - Azure resource ID
 * @param {string} state - Instance state (running, stopped, deallocated, etc.)
 * @param {number} totalMemoryGb - Total VM memory in GB (for percentage calculation)
 * @returns {Object} Normalized metrics with status indicators
 */
const fetchAzureMonitorMetrics = async (monitorClient, resourceId, state = 'unknown', totalMemoryGb = null) => {
    const METRICS_WINDOW_DAYS = parseInt(process.env.METRICS_WINDOW_DAYS) || 30;

    // CRITICAL: Determine instance state FIRST before fetching metrics
    // Requirement 1.1: State Detection Precedes Metrics Collection
    logger.info(`[Metrics] Azure VM ${resourceId} state: ${state}`);

    // CRITICAL: Return early with null metrics if instance is not running
    // Requirement 1.2: Stopped Instances Return Null Metrics
    if (state !== 'running') {
        logger.info(`[Metrics] Skipping metrics for ${resourceId} - instance is ${state} (not running)`);
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

    // Instance is running - proceed with metrics collection
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - METRICS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    logger.info(`[Metrics] Fetching Azure Monitor metrics for ${resourceId} (${METRICS_WINDOW_DAYS}-day window)`);

    let metrics_status = 'missing';
    let memory_metrics_source = 'unavailable';
    let missing_metrics = [];
    let cpu_avg = null;
    let cpu_p95 = null;
    let memory_avg = null;
    let memory_p95 = null;
    let running_hours_last_14d = 0;

    try {
        // CPU Percentage
        const cpuMetrics = await monitorClient.metrics.list(
            resourceId,
            {
                timespan: `${startTime.toISOString()}/${endTime.toISOString()}`,
                interval: 'PT1H', // 1 hour
                metricnames: 'Percentage CPU',
                aggregation: 'Average'
            }
        );

        if (cpuMetrics.value && cpuMetrics.value.length > 0) {
            const cpuTimeseries = cpuMetrics.value[0].timeseries;
            if (cpuTimeseries && cpuTimeseries.length > 0) {
                const cpuData = cpuTimeseries[0].data || [];
                const cpuValues = cpuData
                    .filter(d => d.average !== undefined && d.average !== null)
                    .map(d => d.average);

                if (cpuValues.length > 0) {
                    cpu_avg = cpuValues.reduce((sum, val) => sum + val, 0) / cpuValues.length;
                    cpuValues.sort((a, b) => a - b);
                    const p95Index = Math.floor(cpuValues.length * 0.95);
                    cpu_p95 = cpuValues[p95Index] || cpu_avg * 1.2;

                    // Calculate running hours from number of datapoints (each datapoint = 1 hour)
                    running_hours_last_14d = cpuValues.length;

                    metrics_status = 'partial'; // CPU present, memory unknown
                    logger.info(`Azure Monitor CPU metrics for ${resourceId}: avg=${cpu_avg.toFixed(2)}%, p95=${cpu_p95.toFixed(2)}%, running_hours=${running_hours_last_14d}`);
                } else {
                    logger.warn(`No Azure Monitor CPU datapoints for ${resourceId}`);
                    missing_metrics.push('cpu_avg', 'cpu_p95');
                }
            }
        } else {
            missing_metrics.push('cpu_avg', 'cpu_p95');
        }

        // Available Memory Bytes (requires Azure Monitor Agent)
        try {
            const memMetrics = await monitorClient.metrics.list(
                resourceId,
                {
                    timespan: `${startTime.toISOString()}/${endTime.toISOString()}`,
                    interval: 'PT1H',
                    metricnames: 'Available Memory Bytes',
                    aggregation: 'Average'
                }
            );

            if (memMetrics.value && memMetrics.value.length > 0) {
                const memTimeseries = memMetrics.value[0].timeseries;
                if (memTimeseries && memTimeseries.length > 0) {
                    const memData = memTimeseries[0].data || [];
                    const memValues = memData
                        .filter(d => d.average !== undefined && d.average !== null)
                        .map(d => d.average);

                    if (memValues.length > 0) {
                        // Convert Available Memory Bytes to Memory Used Percentage
                        // Formula: memory_used_percent = ((total_memory - available_memory) / total_memory) × 100
                        memory_metrics_source = 'available';

                        if (totalMemoryGb && totalMemoryGb > 0) {
                            const totalMemoryBytes = totalMemoryGb * 1024 * 1024 * 1024; // Convert GB to bytes

                            // Calculate memory used percentage for each datapoint
                            const memUsedPercentages = memValues.map(availableBytes => {
                                const usedBytes = totalMemoryBytes - availableBytes;
                                return (usedBytes / totalMemoryBytes) * 100;
                            });

                            // Calculate average and p95
                            memory_avg = memUsedPercentages.reduce((sum, val) => sum + val, 0) / memUsedPercentages.length;
                            memUsedPercentages.sort((a, b) => a - b);
                            const p95Index = Math.floor(memUsedPercentages.length * 0.95);
                            memory_p95 = memUsedPercentages[p95Index] || memory_avg * 1.2;

                            if (cpu_avg !== null) {
                                metrics_status = 'complete'; // Both CPU and memory present
                            }

                            logger.info(`Azure Monitor memory metrics for ${resourceId}: avg=${memory_avg.toFixed(2)}%, p95=${memory_p95.toFixed(2)}% (converted from Available Memory Bytes)`);
                        } else {
                            // Can't convert without total memory - log warning
                            logger.warn(`Azure Monitor memory metrics available for ${resourceId}, but cannot convert to percentage without VM memory specs`);
                            memory_metrics_source = 'agent_required';
                            missing_metrics.push('memory_avg', 'memory_p95');
                        }
                    } else {
                        logger.info(`No memory metrics for ${resourceId} - Azure Monitor agent not installed (this is normal)`);
                        memory_metrics_source = 'agent_required';
                        missing_metrics.push('memory_avg', 'memory_p95');
                    }
                } else {
                    memory_metrics_source = 'agent_required';
                    missing_metrics.push('memory_avg', 'memory_p95');
                }
            } else {
                logger.info(`No memory metrics for ${resourceId} - Azure Monitor agent not installed (expected)`);
                memory_metrics_source = 'agent_required';
                missing_metrics.push('memory_avg', 'memory_p95');
            }
        } catch (memError) {
            // Memory metrics not available - this is EXPECTED and NORMAL
            logger.info(`Memory metrics not available for ${resourceId} - Azure Monitor agent not installed (expected)`);
            memory_metrics_source = 'agent_required';
            missing_metrics.push('memory_avg', 'memory_p95');
        }

        // Network In/Out
        const networkInMetrics = await monitorClient.metrics.list(
            resourceId,
            {
                timespan: `${startTime.toISOString()}/${endTime.toISOString()}`,
                interval: 'PT1H',
                metricnames: 'Network In Total',
                aggregation: 'Average'
            }
        );

        const networkOutMetrics = await monitorClient.metrics.list(
            resourceId,
            {
                timespan: `${startTime.toISOString()}/${endTime.toISOString()}`,
                interval: 'PT1H',
                metricnames: 'Network Out Total',
                aggregation: 'Average'
            }
        );

        let network_in_bytes = 0;
        let network_out_bytes = 0;

        if (networkInMetrics.value && networkInMetrics.value.length > 0) {
            const netInData = networkInMetrics.value[0].timeseries?.[0]?.data || [];
            const netInValues = netInData
                .filter(d => d.average !== undefined && d.average !== null)
                .map(d => d.average);
            if (netInValues.length > 0) {
                network_in_bytes = netInValues.reduce((sum, val) => sum + val, 0) / netInValues.length;
            }
        }

        if (networkOutMetrics.value && networkOutMetrics.value.length > 0) {
            const netOutData = networkOutMetrics.value[0].timeseries?.[0]?.data || [];
            const netOutValues = netOutData
                .filter(d => d.average !== undefined && d.average !== null)
                .map(d => d.average);
            if (netOutValues.length > 0) {
                network_out_bytes = netOutValues.reduce((sum, val) => sum + val, 0) / netOutValues.length;
            }
        }

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
            logger.warn(`Insufficient uptime for ${resourceId}: ${uptime_days.toFixed(1)} days < 7 days required`);
        }

        logger.info(`Metrics window for ${resourceId}: ${metrics_window_days} days (uptime: ${uptime_days.toFixed(1)} days)`);

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
        logger.error(`Failed to fetch Azure Monitor metrics for ${resourceId}:`, error.message);
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
 * Test Azure connection and validate permissions
 * Returns detailed permission status with missing permissions and impact
 */
const testConnection = async (creds) => {
    if (!creds.clientId || !creds.clientSecret || !creds.tenantId || !creds.subscriptionId) {
        throw new Error("Missing Azure Credentials");
    }

    // Trim whitespace from all credentials
    const cleanCreds = {
        clientId: creds.clientId.trim(),
        clientSecret: creds.clientSecret.trim(),
        tenantId: creds.tenantId.trim(),
        subscriptionId: creds.subscriptionId.trim()
    };

    try {
        const credential = new ClientSecretCredential(cleanCreds.tenantId, cleanCreds.clientId, cleanCreds.clientSecret);

        // 1. Get Access Token directly - this will fail if credentials are deleted
        let tokenResponse;
        try {
            tokenResponse = await credential.getToken("https://management.azure.com/.default");
            logger.info('[Azure Auth] ✓ Credentials are valid and can authenticate');
        } catch (authError) {
            logger.error('[Azure Auth] ✗ Authentication failed - credentials may be deleted or revoked');

            // Check if this is a credential error
            if (authError.message?.includes('AADSTS') ||
                authError.message?.includes('invalid_client') ||
                authError.message?.includes('unauthorized_client') ||
                authError.message?.includes('invalid_grant') ||
                authError.statusCode === 401) {
                throw new Error('Azure credentials are invalid or have been deleted from Azure AD');
            }

            // Re-throw other errors
            throw authError;
        }

        const token = tokenResponse.token;

        // 2. Test basic subscription access
        const subResponse = await axios.get(
            `https://management.azure.com/subscriptions/${cleanCreds.subscriptionId}?api-version=2020-01-01`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        const sub = subResponse.data;

        // Test required permissions
        const missingPermissions = [];
        const impact = [];
        let connectionStatus = 'full';
        let hasAnyAccess = false;

        // Test Reader role (VM inventory access)
        try {
            const computeClient = new ComputeManagementClient(credential, cleanCreds.subscriptionId);
            await computeClient.virtualMachines.listAll({ top: 1 });
            hasAnyAccess = true;
            logger.info('[Azure Permissions] ✓ Reader role available (VM inventory)');
        } catch (error) {
            if (error.statusCode === 403 || error.code === 'AuthorizationFailed') {
                missingPermissions.push('Reader role');
                impact.push('Cannot fetch VM inventory');
                connectionStatus = 'partial';
                logger.warn('[Azure Permissions] ✗ Reader role missing');
            }
        }

        // Test VM Size API access
        try {
            const computeClient = new ComputeManagementClient(credential, cleanCreds.subscriptionId);
            const location = 'eastus'; // Test with a common region
            await computeClient.virtualMachineSizes.list(location);
            hasAnyAccess = true;
            logger.info('[Azure Permissions] ✓ VM Size API available');
        } catch (error) {
            if (error.statusCode === 403 || error.code === 'AuthorizationFailed') {
                missingPermissions.push('Compute resource access');
                impact.push('Cannot fetch VM specifications');
                connectionStatus = 'partial';
                logger.warn('[Azure Permissions] ✗ VM Size API access missing');
            }
        }

        // Test Monitoring Reader role (metrics access)
        try {
            const monitorClient = new MonitorClient(credential, cleanCreds.subscriptionId);
            // Try to list metric definitions (lightweight test)
            const testResourceId = `/subscriptions/${cleanCreds.subscriptionId}/resourceGroups/test/providers/Microsoft.Compute/virtualMachines/test`;
            try {
                await monitorClient.metricDefinitions.list(testResourceId);
                hasAnyAccess = true;
                logger.info('[Azure Permissions] ✓ Monitoring Reader role available');
            } catch (innerError) {
                // 404 is OK (resource doesn't exist), 403 means no permission
                if (innerError.statusCode === 403 || innerError.code === 'AuthorizationFailed') {
                    throw innerError;
                }
                hasAnyAccess = true;
                logger.info('[Azure Permissions] ✓ Monitoring Reader role available (test resource not found is OK)');
            }
        } catch (error) {
            if (error.statusCode === 403 || error.code === 'AuthorizationFailed') {
                missingPermissions.push('Monitoring Reader role');
                impact.push('Cannot fetch CPU and memory metrics');
                connectionStatus = 'partial';
                logger.warn('[Azure Permissions] ✗ Monitoring Reader role missing');
            }
        }

        // If no APIs are accessible, credentials may have no permissions
        if (!hasAnyAccess && missingPermissions.length > 0) {
            logger.warn(`⚠️  No Azure APIs accessible - credentials may have no permissions`);
            throw new Error('Azure credentials have no permissions. Please grant Reader and Monitoring Reader roles.');
        }

        const message = connectionStatus === 'full'
            ? `Connected to Azure: ${sub.displayName} with full permissions`
            : `Connected to Azure: ${sub.displayName} with partial permissions`;

        return {
            success: true,
            message,
            connection_status: connectionStatus,
            missing_permissions: missingPermissions,
            impact,
            details: sub
        };
    } catch (e) {
        // Handle Axios errors nicely
        let msg = e.response ? `Status ${e.response.status}: ${JSON.stringify(e.response.data)}` : e.message;

        // Provide helpful hint for 403 errors
        if (e.response && e.response.status === 403) {
            msg += " -- HINT: The App Registration (Service Principal) lacks permissions. Please assign the 'Reader' role to it for this Subscription in the Azure Portal (IAM).";
        }

        throw new Error(`Azure Auth Failed: ${msg}`);
    }
};

/**
 * Fetch Azure VMs with Azure Monitor metrics and analyze with ML
 */
const fetchResources = async (userId, creds) => {
    const instances = [];

    try {
        const credential = new ClientSecretCredential(creds.tenantId, creds.clientId, creds.clientSecret);

        // Initialize clients
        const computeClient = new ComputeManagementClient(credential, creds.subscriptionId);
        const monitorClient = new MonitorClient(credential, creds.subscriptionId);

        // Fetch VMs
        logger.info('Fetching Azure VMs...');
        for await (const vm of computeClient.virtualMachines.listAll()) {
            // Only process running VMs
            const instanceView = await computeClient.virtualMachines.instanceView(
                vm.id.split('/')[4], // Resource group name
                vm.name
            );

            const powerState = instanceView.statuses?.find(s => s.code?.startsWith('PowerState/'))?.code || 'PowerState/unknown';
            const state = powerState.replace('PowerState/', ''); // Extract state: running, stopped, deallocated, etc.

            logger.info(`Processing Azure VM ${vm.name} (${state})`);

            const vmSize = vm.hardwareProfile?.vmSize || 'unknown';
            const specs = await getAzureVMSpecsFromAPI(computeClient, vmSize, vm.location);

            // Fetch Azure Monitor metrics only for running VMs
            let metrics;
            if (state === 'running') {
                logger.info(`Fetching metrics for Azure VM ${vm.name} (${state})`);
                metrics = await fetchAzureMonitorMetrics(monitorClient, vm.id, state, specs.memoryGb);
            } else {
                // For stopped/deallocated VMs, use zero metrics
                logger.info(`Skipping metrics for Azure VM ${vm.name} (${state})`);
                metrics = {
                    cpu_avg: 0,
                    cpu_p95: 0,
                    memory_avg: 0,
                    memory_p95: 0,
                    network_in_bytes: 0,
                    network_out_bytes: 0,
                    disk_read_iops: 0,
                    disk_write_iops: 0
                };
            }

            // Calculate uptime (Azure doesn't provide creation time easily, estimate from current time)
            const uptime_hours = 720; // Default to 30 days

            // Detect OS using authoritative method
            const osInfo = detectAzureOS(vm);
            logger.info(`Azure VM ${vm.name}: OS=${osInfo.os_type}, source=${osInfo.os_source}, confidence=${osInfo.os_confidence}`);

            const instanceData = {
                instance_id: vm.id,
                instance_type: vmSize,
                region: vm.location,
                cloud: 'azure',
                state: state, // Add VM state
                os: osInfo.os_type, // Use detected OS
                os_source: osInfo.os_source,
                os_confidence: osInfo.os_confidence,
                vcpu_count: specs.vCpu,
                ram_gb: specs.memoryGb,
                cpu_avg: metrics.cpu_avg,
                cpu_p95: metrics.cpu_p95,
                memory_avg: metrics.memory_avg,
                memory_p95: metrics.memory_p95,
                disk_read_iops: metrics.disk_read_iops,
                disk_write_iops: metrics.disk_write_iops,
                network_in_bytes: metrics.network_in_bytes,
                network_out_bytes: metrics.network_out_bytes,
                uptime_hours,
                cost_per_month: 0, // Will be calculated by ML service from database
                source: 'cloud',
                name: vm.name,
                resource_group: vm.id.split('/')[4]
            };

            // Log detailed instance information
            logger.info(`\n${'='.repeat(80)}`);
            logger.info(`📊 AZURE VM DETAILS FETCHED`);
            logger.info(`${'='.repeat(80)}`);
            logger.info(`VM Name: ${vm.name}`);
            logger.info(`VM ID: ${vm.id}`);
            logger.info(`VM Size: ${vmSize}`);
            logger.info(`Region: ${vm.location}`);
            logger.info(`State: ${state}`);
            logger.info(`Resource Group: ${vm.id.split('/')[4]}`);
            logger.info(`\n--- Hardware Specifications ---`);
            logger.info(`vCPU Count: ${specs.vCpu || 'N/A'}`);
            logger.info(`RAM (GB): ${specs.memoryGb || 'N/A'}`);
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
            logger.info(`${'='.repeat(80)}\n`);

            instances.push(instanceData);
        }

        logger.info(`\n${'='.repeat(80)}`);
        logger.info(`✅ AZURE FETCH SUMMARY`);
        logger.info(`${'='.repeat(80)}`);
        logger.info(`Total VMs Collected: ${instances.length}`);
        logger.info(`Subscription ID: ${creds.subscriptionId}`);
        logger.info(`User ID: ${userId}`);

        // Count by state
        const stateCount = {};
        instances.forEach(inst => {
            stateCount[inst.state] = (stateCount[inst.state] || 0) + 1;
        });
        logger.info(`\nVMs by State:`);
        Object.entries(stateCount).forEach(([state, count]) => {
            logger.info(`  ${state}: ${count}`);
        });

        // Count by OS
        const osCount = {};
        instances.forEach(inst => {
            osCount[inst.os] = (osCount[inst.os] || 0) + 1;
        });
        logger.info(`\nVMs by OS:`);
        Object.entries(osCount).forEach(([os, count]) => {
            logger.info(`  ${os}: ${count}`);
        });

        // Count by region
        const regionCount = {};
        instances.forEach(inst => {
            regionCount[inst.region] = (regionCount[inst.region] || 0) + 1;
        });
        logger.info(`\nVMs by Region:`);
        Object.entries(regionCount).forEach(([region, count]) => {
            logger.info(`  ${region}: ${count}`);
        });

        logger.info(`${'='.repeat(80)}\n`);

        // Validate data before processing
        const validationResults = validateVMBatch(instances, 'azure');

        // Mark invalid VMs with errors
        const validatedInstances = instances.map(vm => {
            const validation = require('../utils/dataValidator').validateVMData(vm, 'azure');
            if (!validation.valid) {
                return markVMWithError(vm, validation.errors);
            }
            return vm;
        });

        // Normalize and enrich instances
        const normalizedVMs = validatedInstances.map(vm => normalizeVM(vm, 'cloud', { cloud: 'azure' }));
        const enrichedVMs = await enrichVMBatch(normalizedVMs);

        // Send to ML service for analysis
        let mlResults = [];
        if (enrichedVMs.length > 0) {
            logger.info(`Sending ${enrichedVMs.length} Azure VMs to ML service`);
            mlResults = await processVMsInBatches(enrichedVMs, 100);
            logger.info(`Received ${mlResults.length} predictions from ML service`);
        }

        // Store results in MongoDB
        for (const result of mlResults) {
            const finding = result.prediction || 'Optimal';
            const savings = result.recommendation?.monthly_savings || result.savings || 0;
            const originalInstance = instances.find(i => i.instance_id === result.instance_id);

            // Extract instance family from instance type (e.g., 'Standard_D' from 'Standard_D2s_v3')
            const instanceFamily = result.instance_type ? result.instance_type.split(/[0-9]/)[0] : null;

            // Determine architecture (most Azure VMs are x86_64)
            const architecture = 'x86_64'; // Azure primarily uses x86_64

            // Parse recommended instance specs (Azure naming: Standard_D2s_v3 = 2 vCPU)
            const getAzureSpecs = (type) => {
                const match = type?.match(/[A-Z]+(\d+)/);
                const vcpu = match ? parseInt(match[1]) : 2;
                const memoryMultiplier = type?.includes('D') ? 4 : type?.includes('E') ? 8 : 2;
                return { vCpu: vcpu, memoryGb: vcpu * memoryMultiplier };
            };

            const recommendedSpecs = result.recommendation?.suggested_instance ?
                getAzureSpecs(result.recommendation.suggested_instance) : null;

            // CRITICAL DEBUG: Log what specs we're about to save
            logger.info(`[SPECS SAVE] ${result.instance_id}: originalInstance vCPU=${originalInstance?.vcpu_count}, RAM=${originalInstance?.ram_gb} | ML vCPU=${result.metrics?.vcpu_count}, RAM=${result.metrics?.ram_gb}`);
            logger.info(`[SPECS SAVE] ${result.instance_id}: SAVING vCPU=${originalInstance?.vcpu_count || null}, RAM=${originalInstance?.ram_gb || null}`);

            await Resource.findOneAndUpdate(
                { resourceId: result.instance_id },
                {
                    $set: {
                        userId,
                        resourceId: result.instance_id,
                        name: originalInstance?.name || result.instance_id.split('/').pop(),
                        provider: 'Azure',
                        service: 'Virtual Machine',
                        region: result.region,
                        resourceType: result.instance_type,
                        state: originalInstance?.state || 'unknown', // Force update VM state
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
                        price_source: 'live', // Azure pricing is fetched live
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
                            (finding === 'Oversized' ? 'VM is oversized based on current usage patterns. Downsizing will maintain performance while reducing costs.' :
                                finding === 'Undersized' ? 'VM is undersized and may experience performance issues. Upgrading is recommended.' :
                                    'VM is optimally sized for current workload.'),

                        created: Date.now(),
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

        logger.info(`Azure VM sync complete for user ${userId}: ${mlResults.length} VMs analyzed`);

        // Also fetch Storage Accounts (no ML analysis needed)
        try {
            const storageClient = new StorageManagementClient(credential, creds.subscriptionId);
            let storageCount = 0;

            for await (const account of storageClient.storageAccounts.list()) {
                await Resource.findOneAndUpdate(
                    { resourceId: account.id },
                    {
                        userId,
                        resourceId: account.id,
                        name: account.name,
                        provider: 'Azure',
                        service: 'Storage Account',
                        region: account.location,
                        resourceType: account.sku?.name || 'Standard',
                        optimizationStatus: 'Optimal',
                        lastFetched: Date.now()
                    },
                    { upsert: true }
                );
                storageCount++;
            }
            logger.info(`Azure Storage sync complete: ${storageCount} accounts`);
        } catch (error) {
            logger.error("Azure Storage Fetch Error", error);
        }

        return {
            success: true,
            instancesAnalyzed: mlResults.length,
            results: mlResults
        };

    } catch (error) {
        logger.error("Azure VM Fetch Error", error);
        throw error;
    }
};

/**
 * Fetch Azure VM resources and return data directly (no MongoDB persistence)
 * This method is used by the controller to fetch resources for localStorage storage
 * It reuses all the data fetching, normalization, enrichment, and ML prediction logic
 * from fetchResources() but skips MongoDB operations
 */
const fetchResourcesSync = async (userId, creds) => {
    const instances = [];

    try {
        const credential = new ClientSecretCredential(creds.tenantId, creds.clientId, creds.clientSecret);

        // Initialize clients
        const computeClient = new ComputeManagementClient(credential, creds.subscriptionId);
        const monitorClient = new MonitorClient(credential, creds.subscriptionId);

        // Fetch VMs
        logger.info('[Sync] Fetching Azure VMs...');
        for await (const vm of computeClient.virtualMachines.listAll()) {
            // Get instance view for power state
            const instanceView = await computeClient.virtualMachines.instanceView(
                vm.id.split('/')[4], // Resource group name
                vm.name
            );

            const powerState = instanceView.statuses?.find(s => s.code?.startsWith('PowerState/'))?.code || 'PowerState/unknown';
            const state = powerState.replace('PowerState/', '');

            logger.info(`[Sync] Processing Azure VM ${vm.name} (${state})`);

            const vmSize = vm.hardwareProfile?.vmSize || 'unknown';
            const specs = await getAzureVMSpecsFromAPI(computeClient, vmSize, vm.location);

            // Fetch Azure Monitor metrics only for running VMs
            let metrics;
            if (state === 'running') {
                logger.info(`[Sync] Fetching metrics for Azure VM ${vm.name} (${state})`);
                metrics = await fetchAzureMonitorMetrics(monitorClient, vm.id, state, specs.memoryGb);
            } else {
                logger.info(`[Sync] Skipping metrics for Azure VM ${vm.name} (${state})`);
                metrics = {
                    cpu_avg: 0,
                    cpu_p95: 0,
                    memory_avg: 0,
                    memory_p95: 0,
                    network_in_bytes: 0,
                    network_out_bytes: 0,
                    disk_read_iops: 0,
                    disk_write_iops: 0
                };
            }

            const uptime_hours = 720; // Default to 30 days

            // Detect OS using authoritative method
            const osInfo = detectAzureOS(vm);
            logger.info(`[Sync] Azure VM ${vm.name}: OS=${osInfo.os_type}, source=${osInfo.os_source}, confidence=${osInfo.os_confidence}`);

            const instanceData = {
                instance_id: vm.id,
                instance_type: vmSize,
                region: vm.location,
                cloud: 'azure',
                state: state,
                os: osInfo.os_type,
                os_source: osInfo.os_source,
                os_confidence: osInfo.os_confidence,
                vcpu_count: specs.vCpu,
                ram_gb: specs.memoryGb,
                architecture: 'x86_64', // Azure VMs are predominantly x86_64
                burstable: false, // Azure doesn't have burstable instances like AWS T-series
                gpu: vmSize?.startsWith('Standard_N') || false, // N-series VMs have GPUs
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
                name: vm.name,
                resource_group: vm.id.split('/')[4]
            };

            instances.push(instanceData);
        }

        logger.info(`\n${'='.repeat(80)}`);
        logger.info(`✅ [Sync] AZURE FETCH SUMMARY`);
        logger.info(`${'='.repeat(80)}`);
        logger.info(`Total VMs Collected: ${instances.length}`);
        logger.info(`Subscription ID: ${creds.subscriptionId}`);
        logger.info(`User ID: ${userId}`);
        logger.info(`${'='.repeat(80)}\n`);

        // Validate data before processing
        const validationResults = validateVMBatch(instances, 'azure');

        // Mark invalid VMs with errors
        const validatedInstances = instances.map(vm => {
            const validation = require('../utils/dataValidator').validateVMData(vm, 'azure');
            if (!validation.valid) {
                return markVMWithError(vm, validation.errors);
            }
            return vm;
        });

        // Normalize and enrich instances
        const normalizedVMs = validatedInstances.map(vm => normalizeVM(vm, 'cloud', { cloud: 'azure' }));
        const enrichedVMs = await enrichVMBatch(normalizedVMs);

        // Send to ML service for analysis
        let mlResults = [];
        if (enrichedVMs.length > 0) {
            logger.info(`[Sync] Sending ${enrichedVMs.length} Azure VMs to ML service`);
            mlResults = await processVMsInBatches(enrichedVMs, 100);
            logger.info(`[Sync] Received ${mlResults.length} predictions from ML service`);
        }

        // Build final results array with all required fields for frontend
        const results = mlResults.map(result => {
            const finding = result.prediction || 'Optimal';
            const savings = result.recommendation?.monthly_savings || result.savings || 0;
            const originalInstance = instances.find(i => i.instance_id === result.instance_id);

            // Extract instance family
            const instanceFamily = result.instance_type ? result.instance_type.split(/[0-9]/)[0] : null;

            // Determine architecture
            const architecture = 'x86_64';

            // Azure doesn't have burstable instances like AWS T-series
            const burstable = false;

            // Detect GPU instances (N-series VMs)
            const gpu = result.instance_type?.startsWith('Standard_N') || false;

            // Parse recommended instance specs
            const getAzureSpecs = (type) => {
                const match = type?.match(/[A-Z]+(\d+)/);
                const vcpu = match ? parseInt(match[1]) : 2;
                const memoryMultiplier = type?.includes('D') ? 4 : type?.includes('E') ? 8 : 2;
                return { vCpu: vcpu, memoryGb: vcpu * memoryMultiplier };
            };

            const recommendedSpecs = result.recommendation?.suggested_instance ?
                getAzureSpecs(result.recommendation.suggested_instance) : null;

            return {
                // Core identification
                instance_id: result.instance_id,
                resourceId: result.instance_id,
                name: originalInstance?.name || result.instance_id.split('/').pop(),
                provider: 'Azure',
                service: 'Virtual Machine',
                cloud: 'azure',

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
                burstable: burstable,
                gpu: gpu,

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
                    (finding === 'Oversized' ? 'VM is oversized based on current usage patterns. Downsizing will maintain performance while reducing costs.' :
                        finding === 'Undersized' ? 'VM is undersized and may experience performance issues. Upgrading is recommended.' :
                            'VM is optimally sized for current workload.'),

                // Timestamps
                created: Date.now(),
                lastFetched: Date.now(),

                // Full metrics object
                metrics: result.metrics,

                // Azure-specific
                resource_group: originalInstance?.resource_group
            };
        });

        logger.info(`[Sync] Azure VM sync complete for user ${userId}: ${results.length} VMs processed`);

        // Return array of resource objects (NO MongoDB operations)
        return results;

    } catch (error) {
        logger.error("[Sync] Azure VM Fetch Error", error);
        throw error;
    }
};

module.exports = { testConnection, fetchResources, fetchResourcesSync };
