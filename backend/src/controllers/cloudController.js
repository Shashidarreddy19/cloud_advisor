const CloudConfig = require('../models/CloudConnection');
const awsService = require('../services/awsService');
const azureService = require('../services/azureService');
const gcpService = require('../services/gcpService');
const Resource = require('../models/Resource'); // For getResources
const User = require('../models/User');
const logger = require('../utils/logger');

const saveConfig = async (req, res) => {
    try {
        const { userId, provider, credentials } = req.body;

        // Test connection and get warnings
        let connectionResult;
        if (provider === 'AWS') {
            connectionResult = await awsService.testConnection(credentials);
        } else if (provider === 'Azure') {
            connectionResult = await azureService.testConnection(credentials);
        } else if (provider === 'GCP') {
            connectionResult = await gcpService.testConnection(credentials);
        } else {
            return res.status(400).json({ error: "Unknown provider" });
        }

        // Save config with warnings
        const config = await CloudConfig.findOneAndUpdate(
            { userId, provider },
            {
                credentials,
                status: 'CONNECTED',
                lastChecked: Date.now(),
                warnings: connectionResult.warnings || [],
                limitedAccess: connectionResult.limitedAccess || false
            },
            { upsert: true, new: true }
        );

        // Trigger sync in background
        if (provider === 'AWS') {
            awsService.fetchResources(userId, credentials).catch(err =>
                logger.error(`AWS sync failed: ${err.message}`)
            );
        } else if (provider === 'Azure') {
            azureService.fetchResources(userId, credentials).catch(err =>
                logger.error(`Azure sync failed: ${err.message}`)
            );
        } else if (provider === 'GCP') {
            logger.info(`🚀 Triggering GCP resource sync for user ${userId}`);
            gcpService.fetchResources(userId, credentials)
                .then(summary => {
                    logger.info(`✅ GCP sync completed:`, summary);
                })
                .catch(err => {
                    logger.error(`❌ GCP sync failed: ${err.message}`, err);
                });
        }

        res.json({
            success: true,
            config,
            message: connectionResult.message,
            warnings: connectionResult.warnings,
            limitedAccess: connectionResult.limitedAccess
        });
    } catch (error) {
        console.error("Save Config Error:", error);
        res.status(400).json({ error: error.message });
    }
};

const syncResources = async (req, res) => {
    try {
        const { userId } = req.body;
        const configs = await CloudConfig.find({ userId, status: 'CONNECTED' });
        configs.forEach(config => {
            if (config.provider === 'AWS') awsService.fetchResources(config.userId, config.credentials);
            else if (config.provider === 'Azure') azureService.fetchResources(config.userId, config.credentials);
            else if (config.provider === 'GCP') gcpService.fetchResources(config.userId, config.credentials);
        });
        res.json({ success: true, message: "Sync triggered" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteConfig = async (req, res) => {
    try {
        const { userId, provider } = req.body;
        await CloudConfig.findOneAndDelete({ userId, provider });
        await Resource.deleteMany({ userId, provider });
        res.json({ success: true, message: "Disconnected" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get current cloud configurations
const getConfig = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        const configs = await CloudConfig.find({ userId: user._id });

        // Mask secrets before sending
        const safeConfigs = configs.map(config => {
            let safeCreds = {};
            if (config.provider === 'AWS') {
                safeCreds = {
                    accessKeyId: config.credentials.accessKeyId,
                    region: config.credentials.region,
                    secretAccessKey: '********' // Masked
                };
            } else if (config.provider === 'Azure') {
                safeCreds = {
                    tenantId: config.credentials.tenantId,
                    clientId: config.credentials.clientId,
                    subscriptionId: config.credentials.subscriptionId,
                    clientSecret: '********' // Masked
                };
            } else if (config.provider === 'GCP') {
                // Try to parse JSON to get project ID
                let projectDetails = {};
                try {
                    const json = JSON.parse(config.credentials.serviceAccountJson);
                    projectDetails = {
                        project_id: json.project_id,
                        client_email: json.client_email
                    };
                } catch (e) {
                    projectDetails = { error: "Invalid JSON" };
                }
                safeCreds = {
                    ...projectDetails,
                    serviceAccountJson: '********' // Masked
                };
            }

            return {
                _id: config._id,
                provider: config.provider,
                status: config.status,
                lastChecked: config.lastChecked,
                credentials: safeCreds,
                warnings: config.warnings || [],
                limitedAccess: config.limitedAccess || false
            };
        });

        res.json(safeConfigs);
    } catch (error) {
        console.error("Get Config Error:", error);
        res.status(500).json({ error: "Failed to fetch configurations" });
    }
};

const getResources = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        const resources = await Resource.find({ userId: user._id });
        res.json({ success: true, resources });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get resources by userId (for compatibility with frontend)
const getResourcesByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const resources = await Resource.find({ userId });
        res.json({ success: true, resources });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get config by userId (for compatibility with frontend)
const getConfigByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const configs = await CloudConfig.find({ userId });

        // Mask secrets before sending
        const safeConfigs = configs.map(config => {
            let safeCreds = {};
            if (config.provider === 'AWS') {
                safeCreds = {
                    accessKeyId: config.credentials.accessKeyId,
                    region: config.credentials.region,
                    secretAccessKey: '********'
                };
            } else if (config.provider === 'Azure') {
                safeCreds = {
                    tenantId: config.credentials.tenantId,
                    clientId: config.credentials.clientId,
                    subscriptionId: config.credentials.subscriptionId,
                    clientSecret: '********'
                };
            } else if (config.provider === 'GCP') {
                let projectDetails = {};
                try {
                    const json = JSON.parse(config.credentials.serviceAccountJson);
                    projectDetails = {
                        project_id: json.project_id,
                        client_email: json.client_email
                    };
                } catch (e) {
                    projectDetails = { error: "Invalid JSON" };
                }
                safeCreds = {
                    ...projectDetails,
                    serviceAccountJson: '********'
                };
            }

            return {
                _id: config._id,
                provider: config.provider,
                status: config.status,
                lastChecked: config.lastChecked,
                credentials: safeCreds,
                warnings: config.warnings || [],
                limitedAccess: config.limitedAccess || false
            };
        });

        res.json(safeConfigs);
    } catch (error) {
        console.error("Get Config Error:", error);
        res.status(500).json({ error: "Failed to fetch configurations" });
    }
};

/**
 * Analyze endpoint - trigger immediate analysis of cloud resources
 */
const analyzeResources = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        const { provider } = req.body;

        // Get cloud config
        const config = await CloudConfig.findOne({ userId: user._id, provider, status: 'CONNECTED' });
        if (!config) {
            return res.status(404).json({ error: `No connected ${provider} account found` });
        }

        // Trigger analysis
        let result;
        if (provider === 'AWS') {
            result = await awsService.fetchResources(user._id, config.credentials);
        } else if (provider === 'Azure') {
            result = await azureService.fetchResources(user._id, config.credentials);
        } else if (provider === 'GCP') {
            result = await gcpService.fetchResources(user._id, config.credentials);
        } else {
            return res.status(400).json({ error: "Unknown provider" });
        }

        res.json({
            success: true,
            message: `Analysis complete for ${provider}`,
            ...result
        });
    } catch (error) {
        logger.error("Analyze Resources Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Fetch available AWS regions for given credentials
 */
const fetchAwsRegions = async (req, res) => {
    try {
        const { accessKeyId, secretAccessKey } = req.body;

        if (!accessKeyId || !secretAccessKey) {
            return res.status(400).json({ error: "Missing AWS credentials" });
        }

        const result = await awsService.fetchAvailableRegions({ accessKeyId, secretAccessKey });

        res.json(result);
    } catch (error) {
        logger.error("Fetch AWS Regions Error:", error);
        res.status(400).json({ error: error.message });
    }
};

// Get single resource by MongoDB ID
const getResourceById = async (req, res) => {
    try {
        const { id } = req.params;
        const resource = await Resource.findById(id);

        if (!resource) {
            return res.status(404).json({ success: false, error: "Resource not found" });
        }

        res.json({ success: true, resource });
    } catch (error) {
        logger.error(`Failed to get resource by ID: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    saveConfig,
    syncResources,
    deleteConfig,
    getResources,
    getResourcesByUserId,
    getResourceById, // Add new method
    getConfig,
    getConfigByUserId,
    analyzeResources,
    fetchAwsRegions
};
