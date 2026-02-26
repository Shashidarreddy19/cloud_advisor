const { EC2Client, DescribeInstancesCommand } = require("@aws-sdk/client-ec2");
const { ComputeManagementClient } = require("@azure/arm-compute");
const { ClientSecretCredential } = require("@azure/identity");
const CloudConfig = require('../models/CloudConnection');
const Resource = require('../models/Resource');
const logger = require('../utils/logger');

/**
 * Instance State Polling Service
 * Polls cloud providers for real-time instance states
 * Runs every 30 seconds to keep instance states up-to-date
 */

let pollingInterval = null;
const POLL_INTERVAL = 30000; // 30 seconds

/**
 * Fetch real-time instance states from AWS
 */
async function fetchAWSInstanceStates(userId, credentials) {
    try {
        const ec2Client = new EC2Client({
            region: credentials.region,
            credentials: {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey
            }
        });

        const command = new DescribeInstancesCommand({});
        const response = await ec2Client.send(command);

        const stateUpdates = [];
        for (const reservation of response.Reservations || []) {
            for (const instance of reservation.Instances || []) {
                const state = instance.State?.Name || 'unknown';
                stateUpdates.push({
                    resourceId: instance.InstanceId,
                    state: state,
                    provider: 'AWS'
                });
            }
        }

        return stateUpdates;
    } catch (error) {
        logger.error(`AWS state polling error for user ${userId}:`, error.message);
        return [];
    }
}

/**
 * Fetch real-time instance states from Azure
 */
async function fetchAzureInstanceStates(userId, credentials) {
    try {
        const credential = new ClientSecretCredential(
            credentials.tenantId,
            credentials.clientId,
            credentials.clientSecret
        );

        const computeClient = new ComputeManagementClient(
            credential,
            credentials.subscriptionId
        );

        const stateUpdates = [];

        // List all VMs
        for await (const vm of computeClient.virtualMachines.listAll()) {
            // Get instance view for power state
            const resourceGroup = vm.id.split('/')[4];
            const vmName = vm.name;

            try {
                const instanceView = await computeClient.virtualMachines.instanceView(
                    resourceGroup,
                    vmName
                );

                // Extract power state
                const powerState = instanceView.statuses?.find(
                    s => s.code?.startsWith('PowerState/')
                );

                let state = 'unknown';
                if (powerState) {
                    const stateCode = powerState.code.replace('PowerState/', '');
                    state = stateCode.toLowerCase(); // running, stopped, deallocated, etc.
                }

                stateUpdates.push({
                    resourceId: vm.id,
                    state: state,
                    provider: 'Azure'
                });
            } catch (vmError) {
                logger.warn(`Failed to get state for Azure VM ${vmName}:`, vmError.message);
            }
        }

        return stateUpdates;
    } catch (error) {
        logger.error(`Azure state polling error for user ${userId}:`, error.message);
        return [];
    }
}

/**
 * Fetch real-time instance states from GCP
 */
async function fetchGCPInstanceStates(userId, credentials) {
    try {
        const credentialsObj = JSON.parse(credentials.serviceAccountJson);
        const compute = require('@google-cloud/compute');
        const instancesClient = new compute.InstancesClient({ credentials: credentialsObj });
        const projectId = credentialsObj.project_id;

        const stateUpdates = [];

        // Use aggregatedList to get all instances across all zones
        const request = { project: projectId };
        const aggListIterable = instancesClient.aggregatedListAsync(request);

        for await (const [zone, instancesObject] of aggListIterable) {
            const instances = instancesObject.instances || [];

            for (const instance of instances) {
                const state = instance.status?.toLowerCase() || 'unknown';
                // GCP states: RUNNING, STOPPED, TERMINATED, STAGING, PROVISIONING, etc.

                stateUpdates.push({
                    resourceId: instance.id.toString(),
                    state: state,
                    provider: 'GCP'
                });
            }
        }

        return stateUpdates;
    } catch (error) {
        logger.error(`GCP state polling error for user ${userId}:`, error.message);
        return [];
    }
}

/**
 * Update instance states in database
 */
async function updateInstanceStates(stateUpdates) {
    let updatedCount = 0;

    for (const update of stateUpdates) {
        try {
            const result = await Resource.updateOne(
                { resourceId: update.resourceId, provider: update.provider },
                {
                    $set: {
                        state: update.state,
                        lastFetched: new Date()
                    }
                }
            );

            if (result.modifiedCount > 0) {
                updatedCount++;
            }
        } catch (error) {
            logger.error(`Failed to update state for ${update.resourceId}:`, error.message);
        }
    }

    return updatedCount;
}

/**
 * Poll all connected cloud accounts for a user
 */
async function pollUserCloudStates(userId) {
    try {
        const configs = await CloudConfig.find({ userId, status: 'CONNECTED' });

        if (configs.length === 0) {
            return { userId, updated: 0, message: 'No connected clouds' };
        }

        let totalUpdates = 0;

        for (const config of configs) {
            let stateUpdates = [];

            if (config.provider === 'AWS') {
                stateUpdates = await fetchAWSInstanceStates(userId, config.credentials);
            } else if (config.provider === 'Azure') {
                stateUpdates = await fetchAzureInstanceStates(userId, config.credentials);
            } else if (config.provider === 'GCP') {
                stateUpdates = await fetchGCPInstanceStates(userId, config.credentials);
            }

            if (stateUpdates.length > 0) {
                const updated = await updateInstanceStates(stateUpdates);
                totalUpdates += updated;
                logger.info(`[State Polling] Updated ${updated} ${config.provider} instances for user ${userId}`);
            }
        }

        return { userId, updated: totalUpdates };
    } catch (error) {
        logger.error(`[State Polling] Error for user ${userId}:`, error.message);
        return { userId, updated: 0, error: error.message };
    }
}

/**
 * Poll all users with connected cloud accounts
 */
async function pollAllUsers() {
    try {
        // Get all unique user IDs with connected clouds
        const configs = await CloudConfig.find({ status: 'CONNECTED' }).distinct('userId');

        if (configs.length === 0) {
            logger.debug('[State Polling] No users with connected clouds');
            return;
        }

        logger.info(`[State Polling] Polling ${configs.length} users...`);

        // Poll each user (can be parallelized if needed)
        const results = await Promise.allSettled(
            configs.map(userId => pollUserCloudStates(userId))
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const totalUpdated = results
            .filter(r => r.status === 'fulfilled')
            .reduce((sum, r) => sum + (r.value?.updated || 0), 0);

        logger.info(`[State Polling] Complete: ${successful}/${configs.length} users, ${totalUpdated} instances updated`);
    } catch (error) {
        logger.error('[State Polling] Error:', error.message);
    }
}

/**
 * Start the polling service
 */
function startPolling() {
    if (pollingInterval) {
        logger.warn('[State Polling] Already running');
        return;
    }

    logger.info(`[State Polling] Starting with ${POLL_INTERVAL / 1000}s interval`);

    // Run immediately on start
    pollAllUsers();

    // Then run on interval
    pollingInterval = setInterval(pollAllUsers, POLL_INTERVAL);
}

/**
 * Stop the polling service
 */
function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        logger.info('[State Polling] Stopped');
    }
}

/**
 * Poll a specific user immediately (on-demand)
 */
async function pollUserNow(userId) {
    logger.info(`[State Polling] On-demand poll for user ${userId}`);
    return await pollUserCloudStates(userId);
}

module.exports = {
    startPolling,
    stopPolling,
    pollUserNow,
    pollAllUsers
};
