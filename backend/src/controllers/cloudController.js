const CloudConfig = require('../models/CloudConnection');
const awsService = require('../services/awsService');
const azureService = require('../services/azureService');
const gcpService = require('../services/gcpService');
const Resource = require('../models/Resource'); // For getResources
const User = require('../models/User');
const logger = require('../utils/logger');
const recommendationEngine = require('../services/recommendationEngine');

/**
 * Test cloud connection without saving credentials
 * Returns connection_status, missing_permissions, and impact
 */
const testConnection = async (req, res) => {
    try {
        const { provider, credentials } = req.body;

        if (!provider || !credentials) {
            return res.status(400).json({ error: "Missing provider or credentials" });
        }

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

        // Return enhanced connection status
        res.json({
            success: connectionResult.success,
            message: connectionResult.message,
            connection_status: connectionResult.connection_status,
            missing_permissions: connectionResult.missing_permissions || [],
            impact: connectionResult.impact || []
        });
    } catch (error) {
        logger.error("Test Connection Error:", error);
        res.status(400).json({
            error: error.message,
            connection_status: 'failed',
            missing_permissions: [],
            impact: []
        });
    }
};

const saveConfig = async (req, res) => {
    try {
        const { userId, provider, credentials } = req.body;

        // Test connection and get enhanced status
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

        // Save config with enhanced connection status
        const config = await CloudConfig.findOneAndUpdate(
            { userId, provider },
            {
                credentials,
                status: 'CONNECTED',
                lastChecked: Date.now(),
                warnings: connectionResult.warnings || [],
                limitedAccess: connectionResult.limitedAccess || false,
                connection_status: connectionResult.connection_status || 'full',
                missing_permissions: connectionResult.missing_permissions || [],
                impact: connectionResult.impact || []
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
            limitedAccess: connectionResult.limitedAccess,
            connection_status: connectionResult.connection_status,
            missing_permissions: connectionResult.missing_permissions,
            impact: connectionResult.impact
        });
    } catch (error) {
        console.error("Save Config Error:", error);
        res.status(400).json({ error: error.message });
    }
};

const syncResources = async (req, res) => {
    try {
        const { userId } = req.body;
        logger.info(`🔄 [FULL SYNC] Triggered for user ${userId} - This will detect OS information`);
        const configs = await CloudConfig.find({ userId, status: 'CONNECTED' });

        if (configs.length === 0) {
            logger.warn(`No connected cloud configs found for user ${userId}`);
            return res.json({ success: true, message: "No connected clouds to sync" });
        }

        logger.info(`Found ${configs.length} connected cloud(s) for user ${userId}`);

        configs.forEach(config => {
            logger.info(`Syncing ${config.provider} for user ${userId}...`);
            if (config.provider === 'AWS') awsService.fetchResources(config.userId, config.credentials);
            else if (config.provider === 'Azure') azureService.fetchResources(config.userId, config.credentials);
            else if (config.provider === 'GCP') gcpService.fetchResources(config.userId, config.credentials);
        });
        res.json({ success: true, message: "Sync triggered" });
    } catch (error) {
        logger.error(`Sync error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Fetch cloud resources and return immediately (for localStorage)
 * Does NOT save to MongoDB - returns data directly to frontend
 */
const fetchCloudResources = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        logger.info(`🔄 [FETCH] Fetching cloud resources for user ${user._id} (localStorage mode)`);

        const configs = await CloudConfig.find({ userId: user._id, status: 'CONNECTED' });

        if (configs.length === 0) {
            logger.warn(`No connected cloud configs found for user ${user._id}`);
            return res.json({ success: true, resources: [], message: "No connected clouds" });
        }

        logger.info(`Found ${configs.length} connected cloud(s) for user ${user._id}`);

        // Fetch resources from all connected clouds in parallel
        const fetchPromises = configs.map(async (config) => {
            try {
                logger.info(`Fetching from ${config.provider}...`);

                if (config.provider === 'AWS') {
                    return await awsService.fetchResourcesSync(user._id, config.credentials);
                } else if (config.provider === 'Azure') {
                    return await azureService.fetchResourcesSync(user._id, config.credentials);
                } else if (config.provider === 'GCP') {
                    return await gcpService.fetchResourcesSync(user._id, config.credentials);
                }

                return [];
            } catch (error) {
                logger.error(`Error fetching from ${config.provider}: ${error.message}`);
                return [];
            }
        });

        const results = await Promise.all(fetchPromises);
        const allResources = results.flat();

        logger.info(`✅ [FETCH] Fetched ${allResources.length} resources total (not saved to DB)`);

        res.json({
            success: true,
            resources: allResources,
            count: allResources.length,
            message: `Fetched ${allResources.length} resources`
        });
    } catch (error) {
        logger.error(`Fetch error: ${error.message}`);
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
                limitedAccess: config.limitedAccess || false,
                connection_status: config.connection_status || 'full',
                missing_permissions: config.missing_permissions || [],
                impact: config.impact || []
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

        // Generate recommendations for each resource
        const resourcesWithRecommendations = resources.map(resource => {
            try {
                const resourceObj = resource.toObject();

                // Log resource data for debugging
                logger.info(`[Recommendation] Processing ${resourceObj.resourceId}:`);
                logger.info(`  State: ${resourceObj.state}`);
                logger.info(`  Running hours: ${resourceObj.running_hours_last_14d}`);
                logger.info(`  CPU avg: ${resourceObj.cpu_avg}, p95: ${resourceObj.cpu_p95}`);
                logger.info(`  Memory avg: ${resourceObj.memory_avg}, p95: ${resourceObj.memory_p95}`);
                logger.info(`  Memory source: ${resourceObj.memory_metrics_source}`);
                logger.info(`  Metrics window: ${resourceObj.metrics_window_days} days`);

                // Generate recommendation using the recommendation engine
                const recommendationResult = recommendationEngine.generateRecommendation(resourceObj);

                logger.info(`[Recommendation] Result for ${resourceObj.resourceId}:`);
                logger.info(`  Recommendation: ${recommendationResult.recommendation}`);
                logger.info(`  Confidence: ${recommendationResult.confidence}`);
                logger.info(`  Warnings: ${JSON.stringify(recommendationResult.warnings)}`);

                // Add recommendation fields to resource
                return {
                    ...resourceObj,
                    recommendation: recommendationResult.recommendation,
                    confidence: recommendationResult.confidence,
                    recommendation_warnings: recommendationResult.warnings || [],
                    metrics_window_days: recommendationResult.metrics_window_days,
                    memory_status: recommendationResult.memory_status
                };
            } catch (error) {
                logger.error(`Failed to generate recommendation for resource ${resource.resourceId}:`, error.message);
                // Return resource without recommendation on error
                return {
                    ...resource.toObject(),
                    recommendation: null,
                    confidence: null,
                    recommendation_warnings: [],
                    error: error.message
                };
            }
        });

        res.json({ success: true, resources: resourcesWithRecommendations });
    } catch (error) {
        logger.error('getResourcesByUserId error:', error);
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
                limitedAccess: config.limitedAccess || false,
                connection_status: config.connection_status || 'full',
                missing_permissions: config.missing_permissions || [],
                impact: config.impact || []
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

        // Fetch cloud connection info to include connection_status and missing_permissions
        const cloudConfig = await CloudConfig.findOne({
            userId: resource.userId,
            provider: resource.provider
        });

        const response = {
            success: true,
            resource: resource.toObject(),
            connection_status: cloudConfig?.connection_status || 'unknown',
            missing_permissions: cloudConfig?.missing_permissions || [],
            impact: cloudConfig?.impact || []
        };

        res.json(response);
    } catch (error) {
        logger.error(`Failed to get resource by ID: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Poll instance states immediately for current user
 */
const pollInstanceStates = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        const { pollUserNow } = require('../services/instanceStatePollingService');
        const result = await pollUserNow(user._id);

        res.json({
            success: true,
            message: `Polled instance states`,
            updated: result.updated
        });
    } catch (error) {
        logger.error("Poll Instance States Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Validate cloud credentials for current user
 */
const validateCredentials = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        const { validateUserConnections } = require('../services/credentialValidationService');
        const result = await validateUserConnections(user._id);

        res.json({
            success: true,
            message: 'Credential validation complete',
            valid: result.valid,
            invalid: result.invalid,
            disconnected: result.disconnected
        });
    } catch (error) {
        logger.error("Validate Credentials Error:", error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    testConnection,
    saveConfig,
    syncResources,
    fetchCloudResources, // NEW: Fetch and return (localStorage mode)
    deleteConfig,
    getResources,
    getResourcesByUserId,
    getResourceById, // Add new method
    getConfig,
    getConfigByUserId,
    analyzeResources,
    fetchAwsRegions,
    pollInstanceStates, // NEW: On-demand polling
    validateCredentials // NEW: Manual credential validation
};
