const { SqlManagementClient } = require("@azure/arm-sql");
const { ProjectsClient } = require('@google-cloud/resource-manager');
const { InstancesClient } = require('@google-cloud/compute');
const { Storage } = require('@google-cloud/storage');

const CloudConfig = require('../models/CloudConfig');
const CloudResource = require('../models/CloudResource');

const { S3Client, ListBucketsCommand } = require("@aws-sdk/client-s3");


const testConnection = async (provider, credentials) => {
    console.log(`Testing connection for ${provider}...`);

    try {
        if (provider === 'AWS') {
            return await testAWS(credentials);
        } else if (provider === 'Azure') {
            return await testAzure(credentials);
        } else if (provider === 'GCP') {
            return await testGCP(credentials);
        } else {
            throw new Error("Unknown provider");
        }
    } catch (error) {
        console.error(`${provider} Connection Failed:`, error.message);
        throw error;
    }
};

const testAWS = async (creds) => {
    if (!creds.accessKeyId || !creds.secretAccessKey) {
        throw new Error("Missing AWS Credentials");
    }

    const client = new STSClient({
        region: creds.region || "us-east-1",
        credentials: {
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey
        }
    });

    const command = new GetCallerIdentityCommand({});
    const response = await client.send(command);

    return {
        success: true,
        message: `Connected to AWS as ${response.Arn}`,
        details: response
    };
};

const testAzure = async (creds) => {
    if (!creds.clientId || !creds.clientSecret || !creds.tenantId || !creds.subscriptionId) {
        throw new Error("Missing Azure Credentials (tenantId, clientId, clientSecret, subscriptionId)");
    }

    try {
        const credential = new ClientSecretCredential(creds.tenantId, creds.clientId, creds.clientSecret);
        const client = new SubscriptionClient(credential);

        // Verify by getting subscription details
        const sub = await client.subscriptions.get(creds.subscriptionId);

        return {
            success: true,
            message: `Connected to Azure Subscription: ${sub.displayName}`,
            details: sub
        };
    } catch (e) {
        throw new Error(`Azure Auth Failed: ${e.message}`);
    }
};

const testGCP = async (creds) => {
    if (!creds.serviceAccountJson) {
        throw new Error("Missing GCP Service Account JSON");
    }

    try {
        const credentialsObj = JSON.parse(creds.serviceAccountJson);
        const client = new ProjectsClient({ credentials: credentialsObj });

        // Verify by listing projects (limit 1) or just initializing
        // searchProjects returns an async iterable
        const projects = client.searchProjects({ query: '' });
        let firstProject = null;
        for await (const project of projects) {
            firstProject = project;
            break; // Just need one to verify
        }

        return {
            success: true,
            message: `Connected to GCP. Found project: ${firstProject ? firstProject.projectId : 'None'}`,
            details: firstProject
        };
    } catch (e) {
        throw new Error(`GCP Auth Failed: ${e.message}`);
    }
};

const saveConfig = async (userId, provider, credentials) => {
    // 1. Test first
    await testConnection(provider, credentials);

    if (!userId) {
        throw new Error("User ID is required to save cloud configuration.");
    }

    // 2. Save if valid
    const config = await CloudConfig.findOneAndUpdate(
        { userId, provider },
        { credentials, status: 'CONNECTED', lastChecked: Date.now() },
        { upsert: true, new: true }
    );


    // 3. Trigger async resource fetching
    if (provider === 'AWS') {
        fetchAWSResources(userId, credentials).catch(err => console.error("Background AWS Fetch Error:", err));
    } else if (provider === 'Azure') {
        fetchAzureResources(userId, credentials).catch(err => console.error("Background Azure Fetch Error:", err));
    } else if (provider === 'GCP') {
        fetchGCPResources(userId, credentials).catch(err => console.error("Background GCP Fetch Error:", err));
    }

    return config;
};


const fetchAWSResources = async (userId, creds) => {
    // EC2
    try {
        const ec2Client = new EC2Client({
            region: creds.region,
            credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey }
        });
        const ec2Data = await ec2Client.send(new DescribeInstancesCommand({}));

        // Process EC2
        for (const reservation of ec2Data.Reservations || []) {
            for (const instance of reservation.Instances || []) {
                const specs = getEc2Specs(instance.InstanceType);

                await CloudResource.findOneAndUpdate(
                    { resourceId: instance.InstanceId },
                    {
                        userId,
                        resourceId: instance.InstanceId,
                        name: instance.Tags?.find(t => t.Key === 'Name')?.Value || instance.InstanceId,
                        provider: 'AWS',
                        service: 'EC2',
                        region: creds.region,
                        resourceType: instance.InstanceType,
                        vCpu: specs.vCpu,
                        memoryGb: specs.memoryGb,
                        optimizationStatus: 'PENDING',
                        created: instance.LaunchTime,
                        lastFetched: Date.now()
                    },
                    { upsert: true }
                );
            }
        }
    } catch (e) {
        console.error("EC2 Fetch Error:", e.message);
    }

    // S3
    try {
        const s3Client = new S3Client({
            region: creds.region,
            credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey }
        });
        const s3Data = await s3Client.send(new ListBucketsCommand({}));

        for (const bucket of s3Data.Buckets || []) {
            // S3 doesn't have metrics in this simple demo, just upsert
            await CloudResource.findOneAndUpdate(
                { resourceId: bucket.Name },
                {
                    userId,
                    resourceId: bucket.Name,
                    name: bucket.Name,
                    provider: 'AWS',
                    service: 'S3',
                    region: creds.region,
                    resourceType: 'Bucket',
                    optimizationStatus: 'OPTIMAL',
                    created: bucket.CreationDate,
                    lastFetched: Date.now()
                },
                { upsert: true }
            );
        }
    } catch (e) {
        console.error("S3 Fetch Error:", e.message);
    }

};

const fetchAzureResources = async (userId, creds) => {
    try {
        const credential = new ClientSecretCredential(creds.tenantId, creds.clientId, creds.clientSecret);

        // 1. Virtual Machines
        const computeClient = new ComputeManagementClient(credential, creds.subscriptionId);
        const vms = computeClient.virtualMachines.listAll();

        for await (const vm of vms) {
            await CloudResource.findOneAndUpdate(
                { resourceId: vm.id },
                {
                    userId,
                    resourceId: vm.id,
                    name: vm.name,
                    provider: 'Azure',
                    service: 'Virtual Machine',
                    region: vm.location,
                    resourceType: vm.hardwareProfile?.vmSize || 'Unknown',
                    optimizationStatus: 'PENDING',
                    created: Date.now(),
                    lastFetched: Date.now()
                },
                { upsert: true }
            );
        }

        // 2. Storage Accounts
        const storageClient = new StorageManagementClient(credential, creds.subscriptionId);
        const accounts = storageClient.storageAccounts.list();

        for await (const account of accounts) {
            await CloudResource.findOneAndUpdate(
                { resourceId: account.id },
                {
                    userId,
                    resourceId: account.id,
                    name: account.name,
                    provider: 'Azure',
                    service: 'Storage Account',
                    region: account.location,
                    resourceType: account.sku?.name || 'Standard_LRS',
                    optimizationStatus: 'OPTIMAL',
                    created: account.creationTime,
                    lastFetched: Date.now()
                },
                { upsert: true }
            );
        }


    } catch (error) {
        console.error("Azure Fetch Error:", error.message);
    }
};

const fetchGCPResources = async (userId, creds) => {
    try {
        const credentialsObj = JSON.parse(creds.serviceAccountJson);
        const projectId = credentialsObj.project_id;

        // 1. Compute Engine (VMs)
        const instancesClient = new InstancesClient({ credentials: credentialsObj });
        const [aggList] = await instancesClient.aggregatedList({ project: projectId });

        for (const [zone, response] of Object.entries(aggList)) {
            if (response.instances) {
                for (const instance of response.instances) {
                    await CloudResource.findOneAndUpdate(
                        { resourceId: instance.id },
                        {
                            userId,
                            resourceId: instance.id,
                            name: instance.name,
                            provider: 'GCP',
                            service: 'Compute Engine',
                            region: zone.replace('zones/', ''),
                            resourceType: instance.machineType?.split('/').pop() || 'Unknown',
                            optimizationStatus: 'PENDING',
                            created: instance.creationTimestamp,
                            lastFetched: Date.now()
                        },
                        { upsert: true }
                    );
                }
            }
        }

        // 2. Cloud Storage (Buckets)
        const storage = new Storage({ credentials: credentialsObj });
        const [buckets] = await storage.getBuckets();

        for (const bucket of buckets) {
            await CloudResource.findOneAndUpdate(
                { resourceId: bucket.id },
                {
                    userId,
                    resourceId: bucket.id,
                    name: bucket.name,
                    provider: 'GCP',
                    service: 'Cloud Storage',
                    region: bucket.location,
                    resourceType: 'Bucket',
                    optimizationStatus: 'OPTIMAL',
                    created: bucket.metadata.timeCreated,
                    lastFetched: Date.now()
                },
                { upsert: true }
            );
        }

    } catch (error) {
        console.error("GCP Fetch Error:", error.message);
    }
};

const getResources = async (userId) => {
    return await CloudResource.find({ userId });
};

const deleteConfig = async (userId, provider) => {
    await CloudConfig.findOneAndDelete({ userId, provider });
    await CloudResource.deleteMany({ userId, provider });
    return { success: true };
};

const syncResources = async (userId) => {
    console.log(`Manual sync triggered for user ${userId}`);
    const configs = await CloudConfig.find({ userId, status: 'CONNECTED' });

    // Run in series or parallel? Parallel is fine.
    const promises = configs.map(config => {
        if (config.provider === 'AWS') return fetchAWSResources(config.userId, config.credentials);
        if (config.provider === 'Azure') return fetchAzureResources(config.userId, config.credentials);
        if (config.provider === 'GCP') return fetchGCPResources(config.userId, config.credentials);
        return Promise.resolve();
    });

    await Promise.all(promises);
    return { success: true, count: configs.length };
};

const startBackgroundSync = () => {
    console.log("Starting Background Cloud Sync...");
    setInterval(async () => {
        try {
            console.log("Running Scheduled Cloud Sync...");
            const configs = await CloudConfig.find({ status: 'CONNECTED' });

            for (const config of configs) {
                if (config.provider === 'AWS') {
                    await fetchAWSResources(config.userId, config.credentials);
                } else if (config.provider === 'Azure') {
                    await fetchAzureResources(config.userId, config.credentials);
                } else if (config.provider === 'GCP') {
                    await fetchGCPResources(config.userId, config.credentials);
                }
            }
        } catch (error) {
            console.error("Background Sync Error:", error);
        }
    }, 5 * 60 * 1000); // Run every 5 minutes
};

module.exports = {
    testConnection,
    saveConfig,
    getResources,
    deleteConfig,
    startBackgroundSync,
    syncResources
};
