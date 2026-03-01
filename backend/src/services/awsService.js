const { EC2Client, DescribeInstancesCommand, DescribeImagesCommand, DescribeInstanceTypesCommand } = require("@aws-sdk/client-ec2");
const { CloudWatchClient, GetMetricStatisticsCommand } = require("@aws-sdk/client-cloudwatch");
const { S3Client, ListBucketsCommand } = require("@aws-sdk/client-s3");
const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");
const Resource = require('../models/Resource');
const logger = require('../utils/logger');
const { normalizeVM } = require('./normalizationService');
const { enrichVMBatch, trackUnresolvableInstance } = require('./enrichmentService');
const { processVMsInBatches } = require('./mlService');
const { validateVMBatch, markVMWithError } = require('../utils/dataValidator');

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
 * ENHANCED: Detects burstable instances (T-series), tracks architecture, logs unknown types
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

            // Detect burstable instances (T-series)
            const burstable = instanceType.startsWith('t2.') ||
                instanceType.startsWith('t3.') ||
                instanceType.startsWith('t3a.') ||
                instanceType.startsWith('t4g.');

            // Detect architecture
            const processorInfo = instanceTypeInfo.ProcessorInfo;
            const architecture = processorInfo?.SupportedArchitectures?.[0] || 'x86_64';

            // Detect GPU
            const gpu = instanceTypeInfo.GpuInfo?.Gpus?.length > 0;

            logger.info(`[AWS Specs] ${instanceType}: ${vCpu} vCPU, ${memoryGb} GB RAM, arch=${architecture}, burstable=${burstable}, gpu=${gpu} (from AWS API)`);

            return {
                vCpu: vCpu,
                memoryGb: memoryGb,
                architecture: architecture,
                burstable: burstable,
                gpu: gpu
            };
        }

        logger.warn(`[AWS Specs] No data returned for ${instanceType}, marking as unresolvable`);

        // Track unknown instance type in database for future updates
        await trackUnresolvableInstance('aws', instanceType, 'unknown');

        return { vCpu: null, memoryGb: null, architecture: null, burstable: false, gpu: false };

    } catch (error) {
        logger.error(`[AWS Specs] Failed to fetch specs for ${instanceType}: ${error.message}`);

        // Track unknown instance type in database
        await trackUnresolvableInstance('aws', instanceType, 'unknown');

        return { vCpu: null, memoryGb: null, architecture: null, burstable: false, gpu: false };
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
 * ENHANCED: Agent detection, 14-day window, running hours calculation, missing metrics tracking
 */
/**
 * Fetch CloudWatch metrics for an EC2 instance
 * Returns average and p95 CPU and memory utilization
 * ENHANCED: State-aware fetching, agent detection, time window validation, running hours calculation
 *
 * @param {Object} cloudWatchClient - AWS CloudWatch client
 * @param {string} instanceId - EC2 instance ID
 * @param {string} region - AWS region
 * @param {string} state - Instance state (running, stopped, terminated, etc.)
 * @returns {Object} Normalized metrics with status indicators
 */
const fetchCloudWatchMetrics = async (cloudWatchClient, instanceId, region, state = 'unknown') => {
    const METRICS_WINDOW_DAYS = parseInt(process.env.METRICS_WINDOW_DAYS) || 30;

    // CRITICAL: Determine instance state FIRST before fetching metrics
    // Requirement 1.1: State Detection Precedes Metrics Collection
    logger.info(`[Metrics] Instance ${instanceId} state: ${state}`);

    // CRITICAL: Return early with null metrics if instance is not running
    // Requirement 1.2: Stopped Instances Return Null Metrics
    if (state !== 'running') {
        logger.info(`[Metrics] Skipping metrics for ${instanceId} - instance is ${state} (not running)`);
        return {
            cpu_avg: null,
            cpu_p95: null,
            memory_avg: null,
            memory_p95: null,
            cpu_credit_balance: null,
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

    logger.info(`[Metrics] Fetching CloudWatch metrics for ${instanceId} (${METRICS_WINDOW_DAYS}-day window)`);

    let metrics_status = 'missing';
    let memory_metrics_source = 'unavailable';
    let missing_metrics = [];
    let cpu_avg = null;
    let cpu_p95 = null;
    let memory_avg = null;
    let memory_p95 = null;
    let cpu_credit_balance = null;
    let running_hours_last_14d = 0;

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

            // Calculate running hours from number of datapoints (each datapoint = 1 hour)
            running_hours_last_14d = cpuDatapoints.length;

            metrics_status = 'partial'; // CPU present, memory unknown

            logger.info(`CloudWatch CPU metrics for ${instanceId}: avg=${cpu_avg.toFixed(2)}%, p95=${cpu_p95.toFixed(2)}%, running_hours=${running_hours_last_14d}`);
        } else {
            logger.warn(`No CloudWatch CPU datapoints for ${instanceId} - instance may be newly launched or metrics not yet available`);
            missing_metrics.push('cpu_avg', 'cpu_p95');
        }

        // CPU Credit Balance (for burstable instances like T-series)
        try {
            const creditCommand = new GetMetricStatisticsCommand({
                Namespace: 'AWS/EC2',
                MetricName: 'CPUCreditBalance',
                Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
                StartTime: startTime,
                EndTime: endTime,
                Period: 3600,
                Statistics: ['Average']
            });

            const creditData = await cloudWatchClient.send(creditCommand);
            const creditDatapoints = creditData.Datapoints || [];

            if (creditDatapoints.length > 0) {
                // Get the most recent credit balance
                const sortedCredits = creditDatapoints.sort((a, b) => b.Timestamp - a.Timestamp);
                cpu_credit_balance = sortedCredits[0].Average;
                logger.info(`CPU credit balance for ${instanceId}: ${cpu_credit_balance.toFixed(2)}`);
            }
        } catch (creditError) {
            // Credit balance not available - this is normal for non-burstable instances
            logger.debug(`CPU credit balance not available for ${instanceId} (expected for non-T-series instances)`);
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

                memory_metrics_source = 'available';

                if (cpu_avg !== null) {
                    metrics_status = 'complete'; // Both CPU and memory present
                }

                logger.info(`CloudWatch memory metrics for ${instanceId}: avg=${memory_avg.toFixed(2)}%, p95=${memory_p95.toFixed(2)}%`);
            } else {
                logger.info(`No memory metrics for ${instanceId} - CloudWatch agent not installed (this is normal)`);
                memory_metrics_source = 'agent_required';
                missing_metrics.push('memory_avg', 'memory_p95');
            }
        } catch (memError) {
            // Memory metrics not available - this is EXPECTED and NORMAL
            logger.info(`Memory metrics not available for ${instanceId} - CloudWatch agent not installed (expected)`);
            memory_metrics_source = 'agent_required';
            missing_metrics.push('memory_avg', 'memory_p95');
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
            cpu_credit_balance: cpu_credit_balance !== null ? Math.round(cpu_credit_balance * 10) / 10 : null,
            network_in_bytes: Math.round(network_in_bytes),
            network_out_bytes: Math.round(network_out_bytes),
            disk_read_iops: 0, // Would need EBS metrics
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
        logger.error(`Failed to fetch CloudWatch metrics for ${instanceId}:`, error.message);
        logger.error(`Error details:`, error);

        // Return null values if metrics fetch fails - DO NOT return fake data
        return {
            cpu_avg: null,
            cpu_p95: null,
            memory_avg: null,
            memory_p95: null,
            cpu_credit_balance: null,
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
}



/**
 * Test AWS connection and validate permissions
 * Returns detailed permission status with missing permissions and impact
 */
const testConnection = async (creds) => {
    if (!creds.accessKeyId || !creds.secretAccessKey) {
        throw new Error("Missing AWS Credentials");
    }

    const region = creds.region || "us-east-1";
    const credentials = {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey
    };

    // Test basic connectivity with STS - this will fail if credentials are deleted
    let identity;
    try {
        const stsClient = new STSClient({ region, credentials });
        const identityCommand = new GetCallerIdentityCommand({});
        identity = await stsClient.send(identityCommand);
        logger.info('[AWS Auth] ✓ Credentials are valid and can authenticate');
    } catch (authError) {
        logger.error('[AWS Auth] ✗ Authentication failed - credentials may be deleted or revoked');

        // Check if this is a credential error
        if (authError.name === 'InvalidClientTokenId' ||
            authError.name === 'SignatureDoesNotMatch' ||
            authError.name === 'UnrecognizedClientException' ||
            authError.message?.includes('security token') ||
            authError.message?.includes('credentials')) {
            throw new Error('AWS credentials are invalid or have been deleted from AWS IAM');
        }

        // Re-throw other errors
        throw authError;
    }

    // Test required permissions
    const missingPermissions = [];
    const impact = [];
    let connectionStatus = 'full';
    let hasAnyAccess = false;

    // Test ec2:DescribeInstances
    try {
        const ec2Client = new EC2Client({ region, credentials });
        await ec2Client.send(new DescribeInstancesCommand({ MaxResults: 5 }));
        hasAnyAccess = true;
        logger.info('[AWS Permissions] ✓ ec2:DescribeInstances available');
    } catch (error) {
        if (error.name === 'UnauthorizedOperation' || error.name === 'AccessDenied') {
            missingPermissions.push('ec2:DescribeInstances');
            impact.push('Cannot fetch EC2 instance inventory');
            connectionStatus = 'partial';
            logger.warn('[AWS Permissions] ✗ ec2:DescribeInstances missing');
        }
    }

    // Test ec2:DescribeInstanceTypes
    try {
        const ec2Client = new EC2Client({ region, credentials });
        await ec2Client.send(new DescribeInstanceTypesCommand({ MaxResults: 1 }));
        hasAnyAccess = true;
        logger.info('[AWS Permissions] ✓ ec2:DescribeInstanceTypes available');
    } catch (error) {
        if (error.name === 'UnauthorizedOperation' || error.name === 'AccessDenied') {
            missingPermissions.push('ec2:DescribeInstanceTypes');
            impact.push('Cannot fetch instance hardware specifications');
            connectionStatus = 'partial';
            logger.warn('[AWS Permissions] ✗ ec2:DescribeInstanceTypes missing');
        }
    }

    // Test cloudwatch:GetMetricStatistics
    try {
        const cloudWatchClient = new CloudWatchClient({ region, credentials });
        const testMetricCommand = new GetMetricStatisticsCommand({
            Namespace: 'AWS/EC2',
            MetricName: 'CPUUtilization',
            StartTime: new Date(Date.now() - 3600000),
            EndTime: new Date(),
            Period: 3600,
            Statistics: ['Average']
        });
        await cloudWatchClient.send(testMetricCommand);
        hasAnyAccess = true;
        logger.info('[AWS Permissions] ✓ cloudwatch:GetMetricStatistics available');
    } catch (error) {
        if (error.name === 'AccessDenied') {
            missingPermissions.push('cloudwatch:GetMetricStatistics');
            impact.push('Cannot fetch CPU and memory metrics');
            connectionStatus = 'partial';
            logger.warn('[AWS Permissions] ✗ cloudwatch:GetMetricStatistics missing');
        }
    }

    // Test pricing:GetProducts (optional but recommended)
    try {
        const { PricingClient, GetProductsCommand } = require("@aws-sdk/client-pricing");
        const pricingClient = new PricingClient({ region: 'us-east-1', credentials }); // Pricing API only in us-east-1
        await pricingClient.send(new GetProductsCommand({
            ServiceCode: 'AmazonEC2',
            MaxResults: 1
        }));
        hasAnyAccess = true;
        logger.info('[AWS Permissions] ✓ pricing:GetProducts available');
    } catch (error) {
        if (error.name === 'AccessDeniedException' || error.name === 'AccessDenied') {
            missingPermissions.push('pricing:GetProducts');
            impact.push('Live pricing unavailable - will use cached pricing');
            connectionStatus = 'partial';
            logger.warn('[AWS Permissions] ✗ pricing:GetProducts missing');
        }
    }

    // If no APIs are accessible, credentials may have no permissions
    if (!hasAnyAccess && missingPermissions.length > 0) {
        logger.warn(`⚠️  No AWS APIs accessible - credentials may have no permissions`);
        throw new Error('AWS credentials have no permissions. Please grant EC2, CloudWatch, or Pricing permissions.');
    }

    const message = connectionStatus === 'full'
        ? `Connected to AWS as ${identity.Arn} with full permissions`
        : `Connected to AWS as ${identity.Arn} with partial permissions`;

    return {
        success: true,
        message,
        connection_status: connectionStatus,
        missing_permissions: missingPermissions,
        impact,
        details: identity
    };
};

/**
 * Fetch AWS EC2 instances with CloudWatch metrics and analyze with ML
 */
const fetchResources = async (userId, creds) => {
    const instances = [];

    try {
        // Fetch all available regions for this account
        logger.info(`Fetching available AWS regions for user ${userId}`);
        const regionsResponse = await fetchAvailableRegions(creds);
        const availableRegions = regionsResponse.regions || [];
        const regionNames = availableRegions.map(r => r.regionName);
        logger.info(`Found ${regionNames.length} enabled regions: ${regionNames.join(', ')}`);

        // Loop through each region and fetch instances
        for (const regionName of regionNames) {
            logger.info(`\n${'='.repeat(80)}`);
            logger.info(`🌍 FETCHING RESOURCES FROM REGION: ${regionName}`);
            logger.info(`${'='.repeat(80)}\n`);

            try {
                const ec2Client = new EC2Client({
                    region: regionName,
                    credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey }
                });

                const cloudWatchClient = new CloudWatchClient({
                    region: regionName,
                    credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey }
                });

                const ec2Data = await ec2Client.send(new DescribeInstancesCommand({}));

                // Skip region if no instances - this speeds up scanning
                if (!ec2Data.Reservations || ec2Data.Reservations.length === 0) {
                    logger.info(`✅ Region ${regionName}: No instances found, skipping`);
                    continue;
                }

                // Collect ALL instances (running, stopped, idle, etc.) from this region
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
                            metrics = await fetchCloudWatchMetrics(cloudWatchClient, instance.InstanceId, regionName, instanceState);
                        } else {
                            // For stopped/idle instances, set metrics to null (not zero)
                            logger.info(`Skipping metrics for AWS instance ${instanceName} (${instanceState})`);
                            metrics = {
                                cpu_avg: null,
                                cpu_p95: null,
                                memory_avg: null,
                                memory_p95: null,
                                cpu_credit_balance: null,
                                network_in_bytes: 0,
                                network_out_bytes: 0,
                                disk_read_iops: 0,
                                disk_write_iops: 0,
                                metrics_status: 'missing',
                                memory_metrics_source: 'unavailable',
                                missing_metrics: [],
                                running_hours_last_14d: 0
                            };
                        }

                        const instanceData = {
                            instance_id: instance.InstanceId,
                            instance_type: instance.InstanceType,
                            region: regionName,
                            cloud: 'aws',
                            state: instanceState, // Current real-time state from AWS
                            os: osInfo.os_type, // Use detected OS
                            os_source: osInfo.os_source,
                            os_confidence: osInfo.os_confidence,
                            vcpu_count: specs.vCpu,
                            ram_gb: specs.memoryGb,
                            architecture: specs.architecture,
                            burstable: specs.burstable,
                            gpu: specs.gpu,
                            cpu_avg: metrics.cpu_avg,
                            cpu_p95: metrics.cpu_p95,
                            memory_avg: metrics.memory_avg,
                            memory_p95: metrics.memory_p95,
                            cpu_credit_balance: metrics.cpu_credit_balance,
                            disk_read_iops: metrics.disk_read_iops,
                            disk_write_iops: metrics.disk_write_iops,
                            network_in_bytes: metrics.network_in_bytes,
                            network_out_bytes: metrics.network_out_bytes,
                            metrics_status: metrics.metrics_status,
                            memory_metrics_source: metrics.memory_metrics_source,
                            missing_metrics: metrics.missing_metrics,
                            running_hours_last_14d: metrics.running_hours_last_14d,
                            cost_per_month: 0, // Will be calculated by ML service from database
                            source: 'cloud',
                            name: instanceName,
                            launch_time: instance.LaunchTime
                        };

                        // Log detailed instance information
                        logger.info(`\n${'='.repeat(80)}`);
                        logger.info(`📊 AWS INSTANCE DETAILS FETCHED`);
                        logger.info(`${'='.repeat(80)}`);
                        logger.info(`Instance Name: ${instanceName}`);
                        logger.info(`Instance ID: ${instance.InstanceId}`);
                        logger.info(`Instance Type: ${instance.InstanceType}`);
                        logger.info(`Region: ${regionName}`);
                        logger.info(`State: ${instanceState}`);
                        logger.info(`Launch Time: ${instance.LaunchTime}`);
                        logger.info(`\n--- Hardware Specifications ---`);
                        logger.info(`vCPU Count: ${specs.vCpu || 'N/A'}`);
                        logger.info(`RAM (GB): ${specs.memoryGb || 'N/A'}`);
                        logger.info(`Architecture: ${specs.architecture || 'N/A'}`);
                        logger.info(`Burstable: ${specs.burstable ? 'Yes (T-series)' : 'No'}`);
                        logger.info(`GPU: ${specs.gpu ? 'Yes' : 'No'}`);
                        logger.info(`\n--- Operating System ---`);
                        logger.info(`OS Type: ${osInfo.os_type}`);
                        logger.info(`OS Source: ${osInfo.os_source}`);
                        logger.info(`OS Confidence: ${osInfo.os_confidence}`);
                        logger.info(`\n--- Metrics (Last 14 Days) ---`);
                        logger.info(`CPU Average: ${metrics.cpu_avg !== null ? metrics.cpu_avg + '%' : 'N/A'}`);
                        logger.info(`CPU P95: ${metrics.cpu_p95 !== null ? metrics.cpu_p95 + '%' : 'N/A'}`);
                        logger.info(`Memory Average: ${metrics.memory_avg !== null ? metrics.memory_avg + '%' : 'N/A (Agent Required)'}`);
                        logger.info(`Memory P95: ${metrics.memory_p95 !== null ? metrics.memory_p95 + '%' : 'N/A (Agent Required)'}`);
                        logger.info(`CPU Credit Balance: ${metrics.cpu_credit_balance !== null ? metrics.cpu_credit_balance : 'N/A'}`);
                        logger.info(`Network In: ${metrics.network_in_bytes} bytes`);
                        logger.info(`Network Out: ${metrics.network_out_bytes} bytes`);
                        logger.info(`Running Hours (14d): ${metrics.running_hours_last_14d} hours`);
                        logger.info(`Metrics Status: ${metrics.metrics_status}`);
                        logger.info(`Memory Metrics Source: ${metrics.memory_metrics_source}`);
                        if (metrics.missing_metrics && metrics.missing_metrics.length > 0) {
                            logger.info(`Missing Metrics: ${metrics.missing_metrics.join(', ')}`);
                        }
                        logger.info(`${'='.repeat(80)}\n`);

                        instances.push(instanceData);
                    }
                }

                logger.info(`✅ Region ${regionName}: Collected ${ec2Data.Reservations?.length || 0} reservations`);

            } catch (regionError) {
                // Log region-specific errors but continue with other regions
                logger.error(`❌ Error fetching from region ${regionName}:`, regionError.message);
                logger.info(`Continuing with remaining regions...`);
            }
        }

        logger.info(`\n${'='.repeat(80)}`);
        logger.info(`✅ AWS MULTI-REGION FETCH SUMMARY`);
        logger.info(`${'='.repeat(80)}`);
        logger.info(`Total Instances Collected: ${instances.length}`);
        logger.info(`Regions Scanned: ${regionNames.length}`);
        logger.info(`User ID: ${userId}`);

        // Count by state
        const stateCount = {};
        instances.forEach(inst => {
            stateCount[inst.state] = (stateCount[inst.state] || 0) + 1;
        });
        logger.info(`\nInstances by State:`);
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

        logger.info(`${'='.repeat(80)}\n`);

        // Validate data before processing
        const validationResults = validateVMBatch(instances, 'aws');

        // Mark invalid VMs with errors
        const validatedInstances = instances.map(vm => {
            const validation = require('../utils/dataValidator').validateVMData(vm, 'aws');
            if (!validation.valid) {
                return markVMWithError(vm, validation.errors);
            }
            return vm;
        });

        // Normalize and enrich instances
        const normalizedVMs = validatedInstances.map(vm => normalizeVM(vm, 'cloud', { cloud: 'aws' }));
        const enrichedVMs = await enrichVMBatch(normalizedVMs);

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
        // S3 buckets are global, so we only need to fetch once using any region
        try {
            const s3Region = regionNames[0] || 'us-east-1'; // Use first available region or default
            const s3Client = new S3Client({
                region: s3Region,
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
                        region: 'global', // S3 buckets are global resources
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

/**
 * Fetch AWS EC2 resources and return data directly (no MongoDB persistence)
 * This method is used by the controller to fetch resources for localStorage storage
 * It reuses all the data fetching, normalization, enrichment, and ML prediction logic
 * from fetchResources() but skips MongoDB operations
 */
const fetchResourcesSync = async (userId, creds) => {
    const instances = [];

    try {
        // Fetch all available regions for this account
        logger.info(`[Sync] Fetching available AWS regions for user ${userId}`);
        const regionsResponse = await fetchAvailableRegions(creds);
        const availableRegions = regionsResponse.regions || [];
        const regionNames = availableRegions.map(r => r.regionName);
        logger.info(`[Sync] Found ${regionNames.length} enabled regions: ${regionNames.join(', ')}`);

        // Loop through each region and fetch instances
        for (const regionName of regionNames) {
            logger.info(`\n${'='.repeat(80)}`);
            logger.info(`🌍 [Sync] FETCHING RESOURCES FROM REGION: ${regionName}`);
            logger.info(`${'='.repeat(80)}\n`);

            try {
                const ec2Client = new EC2Client({
                    region: regionName,
                    credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey }
                });

                const cloudWatchClient = new CloudWatchClient({
                    region: regionName,
                    credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey }
                });

                const ec2Data = await ec2Client.send(new DescribeInstancesCommand({}));

                // Skip region if no instances
                if (!ec2Data.Reservations || ec2Data.Reservations.length === 0) {
                    logger.info(`✅ [Sync] Region ${regionName}: No instances found, skipping`);
                    continue;
                }

                // Collect ALL instances from this region
                for (const reservation of ec2Data.Reservations || []) {
                    for (const instance of reservation.Instances || []) {
                        const instanceState = instance.State.Name;

                        // Fetch real specs from AWS API
                        const specs = await getEc2SpecsFromAWS(ec2Client, instance.InstanceType);
                        const instanceName = instance.Tags?.find(t => t.Key === 'Name')?.Value || instance.InstanceId;

                        // Detect OS using authoritative method
                        const osInfo = await detectAWSOS(ec2Client, instance);
                        logger.info(`[Sync] Instance ${instanceName}: OS=${osInfo.os_type}, source=${osInfo.os_source}, confidence=${osInfo.os_confidence}`);

                        // Fetch CloudWatch metrics only for running instances
                        let metrics;
                        if (instanceState === 'running') {
                            logger.info(`[Sync] Fetching metrics for AWS instance ${instanceName} (${instanceState})`);
                            metrics = await fetchCloudWatchMetrics(cloudWatchClient, instance.InstanceId, regionName, instanceState);
                        } else {
                            logger.info(`[Sync] Skipping metrics for AWS instance ${instanceName} (${instanceState})`);
                            metrics = {
                                cpu_avg: null,
                                cpu_p95: null,
                                memory_avg: null,
                                memory_p95: null,
                                cpu_credit_balance: null,
                                network_in_bytes: 0,
                                network_out_bytes: 0,
                                disk_read_iops: 0,
                                disk_write_iops: 0,
                                metrics_status: 'missing',
                                memory_metrics_source: 'unavailable',
                                missing_metrics: [],
                                running_hours_last_14d: 0
                            };
                        }

                        const instanceData = {
                            instance_id: instance.InstanceId,
                            instance_type: instance.InstanceType,
                            region: regionName,
                            cloud: 'aws',
                            state: instanceState,
                            os: osInfo.os_type,
                            os_source: osInfo.os_source,
                            os_confidence: osInfo.os_confidence,
                            vcpu_count: specs.vCpu,
                            ram_gb: specs.memoryGb,
                            architecture: specs.architecture,
                            burstable: specs.burstable,
                            gpu: specs.gpu,
                            cpu_avg: metrics.cpu_avg,
                            cpu_p95: metrics.cpu_p95,
                            memory_avg: metrics.memory_avg,
                            memory_p95: metrics.memory_p95,
                            cpu_credit_balance: metrics.cpu_credit_balance,
                            disk_read_iops: metrics.disk_read_iops,
                            disk_write_iops: metrics.disk_write_iops,
                            network_in_bytes: metrics.network_in_bytes,
                            network_out_bytes: metrics.network_out_bytes,
                            metrics_status: metrics.metrics_status,
                            memory_metrics_source: metrics.memory_metrics_source,
                            missing_metrics: metrics.missing_metrics,
                            running_hours_last_14d: metrics.running_hours_last_14d,
                            cost_per_month: 0,
                            source: 'cloud',
                            name: instanceName,
                            launch_time: instance.LaunchTime
                        };

                        instances.push(instanceData);
                    }
                }

                logger.info(`✅ [Sync] Region ${regionName}: Collected ${ec2Data.Reservations?.length || 0} reservations`);

            } catch (regionError) {
                logger.error(`❌ [Sync] Error fetching from region ${regionName}:`, regionError.message);
                logger.info(`[Sync] Continuing with remaining regions...`);
            }
        }

        logger.info(`\n${'='.repeat(80)}`);
        logger.info(`✅ [Sync] AWS MULTI-REGION FETCH SUMMARY`);
        logger.info(`${'='.repeat(80)}`);
        logger.info(`Total Instances Collected: ${instances.length}`);
        logger.info(`Regions Scanned: ${regionNames.length}`);
        logger.info(`User ID: ${userId}`);
        logger.info(`${'='.repeat(80)}\n`);

        // Validate data before processing
        const validationResults = validateVMBatch(instances, 'aws');

        // Mark invalid VMs with errors
        const validatedInstances = instances.map(vm => {
            const validation = require('../utils/dataValidator').validateVMData(vm, 'aws');
            if (!validation.valid) {
                return markVMWithError(vm, validation.errors);
            }
            return vm;
        });

        // Normalize and enrich instances
        const normalizedVMs = validatedInstances.map(vm => normalizeVM(vm, 'cloud', { cloud: 'aws' }));
        const enrichedVMs = await enrichVMBatch(normalizedVMs);

        // Send to ML service for analysis
        let mlResults = [];
        if (enrichedVMs.length > 0) {
            logger.info(`[Sync] Sending ${enrichedVMs.length} AWS instances to ML service`);
            mlResults = await processVMsInBatches(enrichedVMs, 100);
            logger.info(`[Sync] Received ${mlResults.length} predictions from ML service`);
        }

        // Build final results array with all required fields for frontend
        const results = mlResults.map(result => {
            const finding = result.prediction || 'Optimal';
            const savings = result.recommendation?.monthly_savings || result.savings || 0;
            const originalInstance = instances.find(i => i.instance_id === result.instance_id);

            // Extract instance family
            const instanceFamily = result.instance_type ? result.instance_type.split('.')[0] : null;

            // Determine architecture
            const architecture = result.instance_type?.includes('graviton') ||
                result.instance_type?.startsWith('a1') ||
                result.instance_type?.startsWith('t4g') ||
                result.instance_type?.startsWith('m6g') ? 'arm64' : 'x86_64';

            // Get recommended instance specs
            const recommendedSpecs = result.recommendation?.suggested_instance ?
                getEc2Specs(result.recommendation.suggested_instance) : null;

            return {
                // Core identification
                instance_id: result.instance_id,
                resourceId: result.instance_id,
                name: originalInstance?.name || result.instance_id,
                provider: 'AWS',
                service: 'EC2',
                cloud: 'aws',

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
                burstable: originalInstance?.burstable || false,
                gpu: originalInstance?.gpu || false,

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
                created: originalInstance?.launch_time,
                launch_time: originalInstance?.launch_time,
                lastFetched: Date.now(),

                // Full metrics object
                metrics: result.metrics
            };
        });

        logger.info(`[Sync] AWS EC2 sync complete for user ${userId}: ${results.length} instances processed`);

        // Return array of resource objects (NO MongoDB operations)
        return results;

    } catch (error) {
        logger.error("[Sync] AWS EC2 Fetch Error", error);
        throw error;
    }
};

module.exports = { testConnection, fetchResources, fetchResourcesSync, fetchAvailableRegions };
