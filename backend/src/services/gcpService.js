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
 * Fetch Cloud Monitoring metrics for a GCP VM instance
 * Returns average and p95 CPU and memory utilization
 */
const fetchCloudMonitoringMetrics = async (monitoringClient, projectId, instanceId, zone) => {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

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

        let cpu_avg = 0;
        let cpu_p95 = 0;

        if (cpuTimeSeries && cpuTimeSeries.length > 0) {
            const cpuValues = cpuTimeSeries[0].points?.map(p => p.value.doubleValue * 100) || [];
            if (cpuValues.length > 0) {
                cpu_avg = cpuValues.reduce((sum, val) => sum + val, 0) / cpuValues.length;
                cpuValues.sort((a, b) => a - b);
                const p95Index = Math.floor(cpuValues.length * 0.95);
                cpu_p95 = cpuValues[p95Index] || cpu_avg * 1.2;
            }
        }

        // Memory Utilization
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

        let memory_avg = 0;
        let memory_p95 = 0;

        if (memTimeSeries && memTimeSeries.length > 0) {
            const memValues = memTimeSeries[0].points?.map(p => p.value.doubleValue) || [];
            if (memValues.length > 0) {
                memory_avg = memValues.reduce((sum, val) => sum + val, 0) / memValues.length;
                memValues.sort((a, b) => a - b);
                const p95Index = Math.floor(memValues.length * 0.95);
                memory_p95 = memValues[p95Index] || memory_avg * 1.2;
            }
        } else {
            // Estimate memory from CPU if not available
            memory_avg = cpu_avg * 0.8;
            memory_p95 = cpu_p95 * 0.8;
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

        return {
            cpu_avg: Math.round(cpu_avg * 10) / 10,
            cpu_p95: Math.round(cpu_p95 * 10) / 10,
            memory_avg: Math.round(memory_avg * 10) / 10,
            memory_p95: Math.round(memory_p95 * 10) / 10,
            network_in_bytes: Math.round(network_in_bytes),
            network_out_bytes: Math.round(network_out_bytes),
            disk_read_iops: 0,
            disk_write_iops: 0
        };
    } catch (error) {
        logger.error(`Failed to fetch Cloud Monitoring metrics for ${instanceId}:`, error.message);
        // Return default values if metrics fetch fails
        return {
            cpu_avg: 50,
            cpu_p95: 70,
            memory_avg: 50,
            memory_p95: 70,
            network_in_bytes: 100000000,
            network_out_bytes: 100000000,
            disk_read_iops: 100,
            disk_write_iops: 100
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

                        // Parse machine type for specs (e.g., n1-standard-1 = 1 vCPU, 3.75 GB)
                        let vcpu_count = 2;
                        let ram_gb = 4;

                        if (machineType.includes('micro')) {
                            vcpu_count = 2; ram_gb = 1;
                        } else if (machineType.includes('small')) {
                            vcpu_count = 2; ram_gb = 2;
                        } else if (machineType.includes('medium')) {
                            vcpu_count = 2; ram_gb = 4;
                        } else if (machineType.includes('standard-1')) {
                            vcpu_count = 1; ram_gb = 3.75;
                        } else if (machineType.includes('standard-2')) {
                            vcpu_count = 2; ram_gb = 7.5;
                        } else if (machineType.includes('standard-4')) {
                            vcpu_count = 4; ram_gb = 15;
                        } else if (machineType.includes('standard-8')) {
                            vcpu_count = 8; ram_gb = 30;
                        }

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

                        instances.push({
                            instance_id: instance.id.toString(),
                            instance_type: machineType,
                            region: zoneName,
                            cloud: 'gcp',
                            state: instanceStatus, // Add instance status
                            os: 'Linux', // GCP doesn't easily expose OS info
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

                await Resource.findOneAndUpdate(
                    { resourceId: result.instance_id },
                    {
                        userId,
                        resourceId: result.instance_id,
                        name: originalInstance?.name || result.instance_id,
                        provider: 'GCP',
                        service: 'Compute Engine',
                        region: result.region,
                        resourceType: result.instance_type,
                        state: originalInstance?.state || 'unknown', // Add instance state
                        vCpu: result.metrics?.vcpu_count || 2,
                        memoryGb: result.metrics?.ram_gb || 4,

                        // Store metrics in the correct fields for frontend
                        avgCpuUtilization: result.metrics?.cpu_avg || 0,
                        maxCpuUtilization: result.metrics?.cpu_p95 || 0,
                        avgMemoryUtilization: result.metrics?.memory_avg || 0,
                        maxMemoryUtilization: result.metrics?.memory_p95 || 0,
                        networkIn: result.metrics?.network_in_bytes || 0,
                        networkOut: result.metrics?.network_out_bytes || 0,
                        diskReadBytes: result.metrics?.disk_read_iops || 0,
                        diskWriteBytes: result.metrics?.disk_write_iops || 0,

                        optimizationStatus: finding,
                        recommendation: result.ml_recommendation_text || result.recommendation,
                        estimatedSavings: savings,
                        estimatedMonthlyCost: result.current_cost_per_month || 0,
                        confidence: result.confidence || 0,
                        currentCost: result.current_cost_per_month || 0,
                        optimizedCost: result.recommendation?.suggested_instance ?
                            (result.current_cost_per_month - savings) : result.current_cost_per_month,
                        recommendedType: result.recommendation?.suggested_instance || result.instance_type,
                        created: originalInstance?.creation_time,
                        lastFetched: Date.now(),
                        metrics: result.metrics
                    },
                    { upsert: true }
                );
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
