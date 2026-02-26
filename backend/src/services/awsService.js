const { EC2Client, DescribeInstancesCommand, DescribeImagesCommand, DescribeInstanceTypesCommand } = require("@aws-sdk/client-ec2");
const { CloudWatchClient, GetMetricStatisticsCommand } = require("@aws-sdk/client-cloudwatch");
const { S3Client, ListBucketsCommand } = require("@aws-sdk/client-s3");
const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");
const Resource = require('../models/Resource');
const logger = require('../utils/logger');
const { normalizeVM } = require('./normalizationService');
const { enrichVMBatch } = require('./enrichmentService');
const { processVMsInBatches } = require('./mlService');
const { handleCloudError } = require('./credentialValidationService');

/**
 * Detect OS from AWS EC2 instance
 * AUTHORITATIVE METHOD: Uses PlatformDetails first, then falls back to AMI lookup
 * Returns: { os_type: 'Linux'|'Windows'|'unknown', os_source: 'cloud'|'inferred'|'unresolved', os_confidence: 'high'|'medium'|'low' }
 */
const detectAWSOS = async (ec2Client, instance) => {
    try {
        logger.info(`[OS Detection] Starting for instance ${instance.InstanceId}`);
        logger.info(`[OS Detection] PlatformDetails: ${instance.PlatformDetails || 'NOT AVAILABLE'}`);
        logger.info(`[OS Detection] Platform: ${instance.Platform || 'NOT AVAILABLE'}`);
        logger.info(`[OS Detection] ImageId: ${instance.ImageId || 'NOT AVAILABLE'}`);

        // Step A: Check PlatformDetails (AUTHORITATIVE)
        if (instance.PlatformDetails) {
            const platformDetails = instance.PlatformDetails.toLowerCase();
            logger.info(`[OS Detection] Checking PlatformDetails: "${platformDetails}"`);

            if (platformDetails.includes('windows')) {
                logger.info(`[OS Detection] ✅ OS detected from PlatformDetails: Windows (${instance.PlatformDetails})`);
                return { os_type: 'Windows', os_source: 'cloud', os_confidence: 'high' };
            }

            // All Linux variants
            if (platformDetails.includes('linux') ||
                platformDetails.includes('red hat') ||
                platformDetails.includes('suse') ||
                platformDetails.includes('ubuntu')) {
                logger.info(`[OS Detection] ✅ OS detected from PlatformDetails: Linux (${instance.PlatformDetails})`);
                return { os_type: 'Linux', os_source: 'cloud', os_confidence: 'high' };
            }

            logger.warn(`[OS Detection] PlatformDetails present but no OS match: "${platformDetails}"`);
        } else {
            logger.warn(`[OS Detection] PlatformDetails NOT available for ${instance.InstanceId}`);
        }

        // Step B: Fallback to Platform field (legacy)
        if (instance.Platform) {
            const platform = instance.Platform.toLowerCase();
            logger.info(`[OS Detection] Checking Platform field: "${platform}"`);
            if (platform === 'windows') {
                logger.info(`[OS Detection] ✅ OS detected from Platform field: Windows`);
                return { os_type: 'Windows', os_source: 'cloud', os_confidence: 'high' };
            }
        } else {
            logger.info(`[OS Detection] Platform field NOT available`);
        }

        // Step C: Fallback to AMI lookup (requires DescribeImages permission)
        if (instance.ImageId) {
            logger.info(`[OS Detection] Attempting AMI lookup for ${instance.ImageId}`);
            try {
                const imageCommand = new DescribeImagesCommand({
                    ImageIds: [instance.ImageId]
                });
                const imageData = await ec2Client.send(imageCommand);

                if (imageData.Images && imageData.Images.length > 0) {
                    const image = imageData.Images[0];
                    logger.info(`[OS Detection] AMI found - Name: ${image.Name}, Platform: ${image.Platform || 'none'}, Description: ${image.Description || 'none'}`);

                    // Check Platform field in AMI
                    if (image.Platform && image.Platform.toLowerCase() === 'windows') {
                        logger.info(`[OS Detection] ✅ OS detected from AMI Platform: Windows`);
                        return { os_type: 'Windows', os_source: 'cloud', os_confidence: 'medium' };
                    }

                    // Check Description for OS hints
                    const description = (image.Description || '').toLowerCase();
                    const name = (image.Name || '').toLowerCase();
                    const combined = description + ' ' + name;

                    if (combined.includes('windows')) {
                        logger.info(`[OS Detection] ✅ OS inferred from AMI description: Windows`);
                        return { os_type: 'Windows', os_source: 'inferred', os_confidence: 'medium' };
                    }

                    if (combined.includes('linux') || combined.includes('ubuntu') ||
                        combined.includes('rhel') || combined.includes('amazon') ||
                        combined.includes('centos') || combined.includes('debian')) {
                        logger.info(`[OS Detection] ✅ OS inferred from AMI description: Linux`);
                        return { os_type: 'Linux', os_source: 'inferred', os_confidence: 'medium' };
                    }

                    logger.warn(`[OS Detection] AMI found but no OS match in name/description`);
                } else {
                    logger.warn(`[OS Detection] AMI ${instance.ImageId} not found in DescribeImages response`);
                }
            } catch (amiError) {
                logger.error(`[OS Detection] Failed to fetch AMI details for ${instance.ImageId}: ${amiError.message}`);
                // Continue to unresolved
            }
        }

        // If no PlatformDetails and no Platform field, assume Linux (most common)
        logger.warn(`[OS Detection] ⚠️ OS could not be determined for instance ${instance.InstanceId}, defaulting to Linux`);
        return { os_type: 'Linux', os_source: 'inferred', os_confidence: 'low' };

    } catch (error) {
        logger.error(`[OS Detection] ❌ OS detection failed for instance ${instance.InstanceId}: ${error.message}`);
        return { os_type: 'unknown', os_source: 'unresolved', os_confidence: 'low' };
    }
};

/**
 * Fetch real instance type specifications from AWS API
 * Returns actual vCPU and memory from AWS, not from lookup table
 */
const getEc2SpecsFromAWS = async (ec2Client, instanceType) => {
    try {
        const command = new DescribeInstanceTypesCommand({
            InstanceTypes: [instanceType]
        });

        const response = await ec2Client.send(command);

        if (response.InstanceTypes && response.InstanceTypes.length > 0) {
            const instanceTypeInfo = response.InstanceTypes[0];
            const vCpu = instanceTypeInfo.VCpuInfo?.DefaultVCpus || null;
            const memoryMiB = instanceTypeInfo.MemoryInfo?.SizeInMiB || null;
            const memoryGb = memoryMiB ? memoryMiB / 1024 : null; // NO ROUNDING - exact value

            logger.info(`[AWS Specs] ${instanceType}: ${vCpu} vCPU, ${memoryGb} GB RAM (from AWS API)`);

            return {
                vCpu: vCpu,
                memoryGb: memoryGb
            };
        }

        logger.warn(`[AWS Specs] No data returned for ${instanceType}, using fallback`);
        return getEc2Specs(instanceType); // Fallback to lookup table

    } catch (error) {
        logger.error(`[AWS Specs] Failed to fetch specs for ${instanceType}: ${error.message}`);
        return getEc2Specs(instanceType); // Fallback to lookup table
    }
};

// Spec Helper (Moved from cloudService)
const getEc2Specs = (type) => {
    logger.warn(`[AWS Specs] No specs available for ${type} - returning NULL`);
    return { vCpu: null, memoryGb: null };
};


/**
 * Fetch CloudWatch metrics for an EC2 instance
 * Returns average and p95 CPU and memory utilization
 * FIXED: Proper null handling, 14-day window, no estimates
 */
const fetchCloudWatchMetrics = async (cloudWatchClient, instanceId, region) => {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 14 * 24 * 60 * 60 * 1000); // Last 14 days (not 7)

    let metrics_status = 'missing';
    let cpu_avg = null;
    let cpu_p95 = null;
    let memory_avg = null;
    let memory_p95 = null;

    try {
        // CPU Utilization - CRITICAL: Must fetch from AWS/EC2
        const cpuCommand = new GetMetricStatisticsCommand({
            Namespace: 'AWS/EC2',
            MetricName: 'CPUUtilization',
            Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 3600, // 1 hour
            Statistics: ['Average']
        });

        const cpuData = await cloudWatchClient.send(cpuCommand);
        const cpuDatapoints = cpuData.Datapoints || [];

        if (cpuDatapoints.length > 0) {
            // Calculate average from all datapoints
            cpu_avg = cpuDatapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / cpuDatapoints.length;

            // Calculate p95 manually from datapoints
            const cpuValues = cpuDatapoints.map(dp => dp.Average || 0).sort((a, b) => a - b);
            const p95Index = Math.floor(cpuValues.length * 0.95);
            cpu_p95 = cpuValues[p95Index] || cpu_avg * 1.2;

            metrics_status = 'partial'; // CPU present, memory unknown

            logger.info(`CloudWatch CPU metrics for ${instanceId}: avg=${cpu_avg.toFixed(2)}%, p95=${cpu_p95.toFixed(2)}%`);
        } else {
            logger.warn(`No CloudWatch CPU datapoints for ${instanceId} - instance may be newly launched or metrics not yet available`);
            // Keep cpu_avg and cpu_p95 as null
        }

        // Memory metrics (optional - requires CloudWatch agent)
        try {
            const memCommand = new GetMetricStatisticsCommand({
                Namespace: 'CWAgent',
                MetricName: 'mem_used_percent',
                Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
                StartTime: startTime,
                EndTime: endTime,
                Period: 3600,
                Statistics: ['Average']
            });

            const memData = await cloudWatchClient.send(memCommand);
            const memDatapoints = memData.Datapoints || [];

            if (memDatapoints.length > 0) {
                memory_avg = memDatapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / memDatapoints.length;

                // Calculate p95 manually
                const memValues = memDatapoints.map(dp => dp.Average || 0).sort((a, b) => a - b);
                const p95Index = Math.floor(memValues.length * 0.95);
                memory_p95 = memValues[p95Index] || memory_avg * 1.2;

                if (cpu_avg !== null) {
                    metrics_status = 'complete'; // Both CPU and memory present
                }

                logger.info(`CloudWatch memory metrics for ${instanceId}: avg=${memory_avg.toFixed(2)}%, p95=${memory_p95.toFixed(2)}%`);
            } else {
                logger.info(`No memory metrics for ${instanceId} - CloudWatch agent not installed (this is normal)`);
                // Keep memory_avg and memory_p95 as null - this is expected
            }
        } catch (memError) {
            // Memory metrics not available - this is EXPECTED and NORMAL
            logger.info(`Memory metrics not available for ${instanceId} - CloudWatch agent not installed (expected)`);
            // Keep memory as null - DO NOT estimate, DO NOT set to 0
        }

        // Network metrics
        const networkInCommand = new GetMetricStatisticsCommand({
            Namespace: 'AWS/EC2',
            MetricName: 'NetworkIn',
            Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 3600,
            Statistics: ['Average']
        });

        const networkOutCommand = new GetMetricStatisticsCommand({
            Namespace: 'AWS/EC2',
            MetricName: 'NetworkOut',
            Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 3600,
            Statistics: ['Average']
        });

        const [networkInData, networkOutData] = await Promise.all([
            cloudWatchClient.send(networkInCommand),
            cloudWatchClient.send(networkOutCommand)
        ]);

        const networkInDatapoints = networkInData.Datapoints || [];
        const networkOutDatapoints = networkOutData.Datapoints || [];

        const network_in_bytes = networkInDatapoints.length > 0
            ? networkInDatapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / networkInDatapoints.length
            : 0;

        const network_out_bytes = networkOutDatapoints.length > 0
            ? networkOutDatapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / networkOutDatapoints.length
            : 0;

        // Return metrics with proper null handling
        return {
            cpu_avg: cpu_avg !== null ? Math.round(cpu_avg * 10) / 10 : null,
            cpu_p95: cpu_p95 !== null ? Math.round(cpu_p95 * 10) / 10 : null,
            memory_avg: memory_avg !== null ? Math.round(memory_avg * 10) / 10 : null,
            memory_p95: memory_p95 !== null ? Math.round(memory_p95 * 10) / 10 : null,
            network_in_bytes: Math.round(network_in_bytes),
            network_out_bytes: Math.round(network_out_bytes),
            disk_read_iops: 0, // Would need EBS metrics
            disk_write_iops: 0,
            metrics_status: metrics_status // 'complete', 'partial', or 'missing'
        };
    } catch (error) {
        logger.error(`Failed to fetch CloudWatch metrics for ${instanceId}:`, error.message);
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



const testConnection = async (creds) => {
    if (!creds.accessKeyId || !creds.secretAccessKey) {
        throw new Error("Missing AWS Credentials");
    }
    const client = new STSClient({
        region: creds.region || "us-east-1",
        credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey }
    });
    const command = new GetCallerIdentityCommand({});
    const response = await client.send(command);
    return { success: true, message: `Connected to AWS as ${response.Arn}`, details: response };
};

/**
 * Fetch AWS EC2 instances with CloudWatch metrics and analyze with ML
 */
const fetchResources = async (userId, creds) => {
    const instances = [];

    try {
        const ec2Client = new EC2Client({
            region: creds.region,
            credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey }
        });

        const cloudWatchClient = new CloudWatchClient({
            region: creds.region,
            credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey }
        });

        const ec2Data = await ec2Client.send(new DescribeInstancesCommand({}));

        // Collect ALL instances (running, stopped, idle, etc.)
        for (const reservation of ec2Data.Reservations || []) {
            for (const instance of reservation.Instances || []) {
                // Process all instances regardless of state
                const instanceState = instance.State.Name; // running, stopped, stopping, terminated, etc.

                // Fetch real specs from AWS API
                const specs = await getEc2SpecsFromAWS(ec2Client, instance.InstanceType);
                const instanceName = instance.Tags?.find(t => t.Key === 'Name')?.Value || instance.InstanceId;

                // Detect OS using authoritative method
                const osInfo = await detectAWSOS(ec2Client, instance);
                logger.info(`Instance ${instanceName}: OS=${osInfo.os_type}, source=${osInfo.os_source}, confidence=${osInfo.os_confidence}`);

                // Fetch CloudWatch metrics only for running instances
                let metrics;
                if (instanceState === 'running') {
                    logger.info(`Fetching metrics for AWS instance ${instanceName} (${instanceState})`);
                    metrics = await fetchCloudWatchMetrics(cloudWatchClient, instance.InstanceId, creds.region);
                } else {
                    // For stopped/idle instances, use zero metrics
                    logger.info(`Skipping metrics for AWS instance ${instanceName} (${instanceState})`);
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

                // Calculate uptime (hours since launch)
                const launchTime = new Date(instance.LaunchTime);
                const uptime_hours = Math.round((Date.now() - launchTime.getTime()) / (1000 * 60 * 60));

                instances.push({
                    instance_id: instance.InstanceId,
                    instance_type: instance.InstanceType,
                    region: creds.region,
                    cloud: 'aws',
                    state: instanceState, // Current real-time state from AWS
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
                    name: instanceName,
                    launch_time: instance.LaunchTime
                });
            }
        }

        logger.info(`Collected ${instances.length} AWS EC2 instances (all states)`);

        // Normalize and enrich instances
        const normalizedVMs = instances.map(vm => normalizeVM(vm, 'cloud', { cloud: 'aws' }));
        const enrichedVMs = enrichVMBatch(normalizedVMs);

        // Send to ML service for analysis (only for running instances with metrics)
        let mlResults = [];
        if (enrichedVMs.length > 0) {
            logger.info(`Sending ${enrichedVMs.length} AWS instances to ML service`);
            mlResults = await processVMsInBatches(enrichedVMs, 100);
            logger.info(`Received ${mlResults.length} predictions from ML service`);
        }

        // Store results in MongoDB
        for (const result of mlResults) {
            const finding = result.prediction || 'Optimal';
            const savings = result.recommendation?.monthly_savings || result.savings || 0;
            const originalInstance = instances.find(i => i.instance_id === result.instance_id);

            // Extract instance family from instance type (e.g., 't3' from 't3.medium')
            const instanceFamily = result.instance_type ? result.instance_type.split('.')[0] : null;

            // Determine architecture (most AWS instances are x86_64, some are arm64)
            const architecture = result.instance_type?.includes('graviton') || result.instance_type?.startsWith('a1') || result.instance_type?.startsWith('t4g') || result.instance_type?.startsWith('m6g') ? 'arm64' : 'x86_64';

            // Get recommended instance specs
            const recommendedSpecs = result.recommendation?.suggested_instance ?
                getEc2Specs(result.recommendation.suggested_instance) : null;

            // CRITICAL DEBUG: Log what specs we're about to save
            logger.info(`[SPECS SAVE] ${result.instance_id}: originalInstance vCPU=${originalInstance?.vcpu_count}, RAM=${originalInstance?.ram_gb} | ML vCPU=${result.metrics?.vcpu_count}, RAM=${result.metrics?.ram_gb}`);
            logger.info(`[SPECS SAVE] ${result.instance_id}: SAVING vCPU=${originalInstance?.vcpu_count || null}, RAM=${originalInstance?.ram_gb || null}`);

            await Resource.findOneAndUpdate(
                { resourceId: result.instance_id },
                {
                    $set: {
                        userId,
                        resourceId: result.instance_id,
                        name: originalInstance?.name || result.instance_id,
                        provider: 'AWS',
                        service: 'EC2',
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
                        price_source: 'live', // AWS pricing is fetched live
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

                        created: originalInstance?.launch_time,
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

        logger.info(`AWS EC2 sync complete for user ${userId}: ${mlResults.length} instances analyzed`);

        // Also fetch S3 buckets (no ML analysis needed)
        try {
            const s3Client = new S3Client({
                region: creds.region,
                credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey }
            });
            const s3Data = await s3Client.send(new ListBucketsCommand({}));

            for (const bucket of s3Data.Buckets || []) {
                await Resource.findOneAndUpdate(
                    { resourceId: bucket.Name },
                    {
                        userId,
                        resourceId: bucket.Name,
                        name: bucket.Name,
                        provider: 'AWS',
                        service: 'S3',
                        region: creds.region,
                        resourceType: 'Bucket',
                        optimizationStatus: 'Optimal',
                        created: bucket.CreationDate,
                        lastFetched: Date.now()
                    },
                    { upsert: true }
                );
            }
            logger.info(`AWS S3 sync complete: ${s3Data.Buckets?.length || 0} buckets`);
        } catch (e) {
            logger.error("S3 Fetch Error", e);
        }

        return {
            success: true,
            instancesAnalyzed: mlResults.length,
            results: mlResults
        };

    } catch (error) {
        logger.error("AWS EC2 Fetch Error", error);

        // Handle credential errors
        const errorInfo = await handleCloudError(error, userId, 'AWS');
        if (errorInfo.isCredentialError) {
            throw new Error(errorInfo.message);
        }

        throw error;
    }
};

/**
 * Fetch available AWS regions for the given credentials
 * Returns list of regions the user has access to
 */
const fetchAvailableRegions = async (creds) => {
    if (!creds.accessKeyId || !creds.secretAccessKey) {
        throw new Error("Missing AWS Credentials");
    }

    try {
        // Use EC2 client to describe regions
        const { DescribeRegionsCommand } = require("@aws-sdk/client-ec2");

        const ec2Client = new EC2Client({
            region: "us-east-1", // Use a default region to query available regions
            credentials: {
                accessKeyId: creds.accessKeyId,
                secretAccessKey: creds.secretAccessKey
            }
        });

        const command = new DescribeRegionsCommand({
            AllRegions: false, // Only return regions that are enabled for the account
            Filters: [
                {
                    Name: "opt-in-status",
                    Values: ["opt-in-not-required", "opted-in"]
                }
            ]
        });

        const response = await ec2Client.send(command);

        // Map regions to a more user-friendly format
        const regions = (response.Regions || []).map(region => ({
            regionName: region.RegionName,
            endpoint: region.Endpoint,
            optInStatus: region.OptInStatus
        }));

        logger.info(`Found ${regions.length} available AWS regions for user`);

        return {
            success: true,
            regions: regions,
            count: regions.length
        };
    } catch (error) {
        logger.error("Failed to fetch AWS regions:", error.message);
        throw new Error(`Failed to fetch available regions: ${error.message}`);
    }
};

module.exports = { testConnection, fetchResources, fetchAvailableRegions };
