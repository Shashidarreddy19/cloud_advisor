const { EC2Client, DescribeInstancesCommand } = require("@aws-sdk/client-ec2");
const { CloudWatchClient, GetMetricStatisticsCommand } = require("@aws-sdk/client-cloudwatch");
const { S3Client, ListBucketsCommand } = require("@aws-sdk/client-s3");
const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");
const Resource = require('../models/Resource');
const logger = require('../utils/logger');
const { normalizeVM } = require('./normalizationService');
const { enrichVMBatch } = require('./enrichmentService');
const { processVMsInBatches } = require('./mlService');
const { handleCloudError } = require('./credentialValidationService');

// Spec Helper (Moved from cloudService)
const getEc2Specs = (type) => {
    const specs = {
        't2.micro': { vCpu: 1, memoryGb: 1 },
        't2.small': { vCpu: 1, memoryGb: 2 },
        't2.medium': { vCpu: 2, memoryGb: 4 },
        't3.micro': { vCpu: 2, memoryGb: 1 },
        't3.small': { vCpu: 2, memoryGb: 2 },
        't3.medium': { vCpu: 2, memoryGb: 4 },
        't3.large': { vCpu: 2, memoryGb: 8 },
        'm5.large': { vCpu: 2, memoryGb: 8 },
        'm5.xlarge': { vCpu: 4, memoryGb: 16 },
        'c5.large': { vCpu: 2, memoryGb: 4 },
        'c5.xlarge': { vCpu: 4, memoryGb: 8 },
        'r5.large': { vCpu: 2, memoryGb: 16 },
        'r5.xlarge': { vCpu: 4, memoryGb: 32 }
    };
    return specs[type] || { vCpu: 2, memoryGb: 4 };
};

/**
 * Fetch CloudWatch metrics for an EC2 instance
 * Returns average and p95 CPU and memory utilization
 */
const fetchCloudWatchMetrics = async (cloudWatchClient, instanceId, region) => {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

    try {
        // CPU Utilization
        const cpuCommand = new GetMetricStatisticsCommand({
            Namespace: 'AWS/EC2',
            MetricName: 'CPUUtilization',
            Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 3600, // 1 hour
            Statistics: ['Average'],
            ExtendedStatistics: ['p95']
        });

        const cpuData = await cloudWatchClient.send(cpuCommand);

        // Calculate averages
        const cpuDatapoints = cpuData.Datapoints || [];
        const cpu_avg = cpuDatapoints.length > 0
            ? cpuDatapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / cpuDatapoints.length
            : 0;

        const cpu_p95 = cpuDatapoints.length > 0 && cpuDatapoints[0]['p95']
            ? cpuDatapoints.reduce((sum, dp) => sum + (dp['p95'] || 0), 0) / cpuDatapoints.length
            : cpu_avg * 1.2; // Estimate if not available

        // Memory metrics (if CloudWatch agent is installed)
        let memory_avg = 0;
        let memory_p95 = 0;

        try {
            const memCommand = new GetMetricStatisticsCommand({
                Namespace: 'CWAgent',
                MetricName: 'mem_used_percent',
                Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
                StartTime: startTime,
                EndTime: endTime,
                Period: 3600,
                Statistics: ['Average'],
                ExtendedStatistics: ['p95']
            });

            const memData = await cloudWatchClient.send(memCommand);
            const memDatapoints = memData.Datapoints || [];

            if (memDatapoints.length > 0) {
                memory_avg = memDatapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / memDatapoints.length;
                memory_p95 = memDatapoints[0]['p95']
                    ? memDatapoints.reduce((sum, dp) => sum + (dp['p95'] || 0), 0) / memDatapoints.length
                    : memory_avg * 1.2;
            }
        } catch (memError) {
            // CloudWatch agent not installed, use estimates
            logger.warn(`CloudWatch agent metrics not available for ${instanceId}, using estimates`);
            memory_avg = cpu_avg * 0.8; // Estimate based on CPU
            memory_p95 = cpu_p95 * 0.8;
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

        return {
            cpu_avg: Math.round(cpu_avg * 10) / 10,
            cpu_p95: Math.round(cpu_p95 * 10) / 10,
            memory_avg: Math.round(memory_avg * 10) / 10,
            memory_p95: Math.round(memory_p95 * 10) / 10,
            network_in_bytes: Math.round(network_in_bytes),
            network_out_bytes: Math.round(network_out_bytes),
            disk_read_iops: 0, // Would need EBS metrics
            disk_write_iops: 0
        };
    } catch (error) {
        logger.error(`Failed to fetch CloudWatch metrics for ${instanceId}:`, error.message);
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

                const specs = getEc2Specs(instance.InstanceType);
                const instanceName = instance.Tags?.find(t => t.Key === 'Name')?.Value || instance.InstanceId;

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
                    state: instanceState, // Add instance state
                    os: instance.Platform === 'windows' ? 'Windows' : 'Linux',
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

            await Resource.findOneAndUpdate(
                { resourceId: result.instance_id },
                {
                    userId,
                    resourceId: result.instance_id,
                    name: originalInstance?.name || result.instance_id,
                    provider: 'AWS',
                    service: 'EC2',
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
                    created: originalInstance?.launch_time,
                    lastFetched: Date.now(),
                    metrics: result.metrics
                },
                { upsert: true }
            );
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
