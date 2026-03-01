const CloudConfig = require('../models/CloudConnection');
const Resource = require('../models/Resource');
const awsService = require('./awsService');
const azureService = require('./azureService');
const gcpService = require('./gcpService');
const logger = require('../utils/logger');

/**
 * Credential Validation Service
 * Periodically validates cloud credentials and automatically disconnects invalid ones
 */

// Validation interval: 5 minutes
const VALIDATION_INTERVAL = 5 * 60 * 1000;

// Track validation intervals
let validationIntervalId = null;

/**
 * Validate a single cloud connection
 * @param {Object} config - CloudConfig document
 * @returns {Object} Validation result
 */
async function validateConnection(config) {
    try {
        logger.info(`Validating ${config.provider} connection for user ${config.userId}`);

        let validationResult;

        // Test connection based on provider
        if (config.provider === 'AWS') {
            validationResult = await awsService.testConnection(config.credentials);
        } else if (config.provider === 'Azure') {
            validationResult = await azureService.testConnection(config.credentials);
        } else if (config.provider === 'GCP') {
            validationResult = await gcpService.testConnection(config.credentials);
        } else {
            logger.warn(`Unknown provider: ${config.provider}`);
            return { valid: false, reason: 'Unknown provider' };
        }

        // Check if connection is successful
        if (!validationResult.success) {
            logger.warn(`${config.provider} connection failed for user ${config.userId}: ${validationResult.message}`);
            return {
                valid: false,
                reason: validationResult.message || 'Connection failed',
                connection_status: validationResult.connection_status || 'failed',
                missing_permissions: validationResult.missing_permissions || [],
                impact: validationResult.impact || []
            };
        }

        // Connection is valid
        logger.info(`${config.provider} connection valid for user ${config.userId}`);
        return {
            valid: true,
            connection_status: validationResult.connection_status || 'full',
            missing_permissions: validationResult.missing_permissions || [],
            impact: validationResult.impact || []
        };

    } catch (error) {
        logger.error(`Error validating ${config.provider} connection for user ${config.userId}:`, error);

        // Check for specific error types that indicate deleted/invalid credentials
        const errorMessage = error.message || '';
        const errorName = error.name || '';
        const errorCode = error.code || '';

        const isCredentialError =
            // AWS errors
            errorName === 'InvalidClientTokenId' ||
            errorName === 'SignatureDoesNotMatch' ||
            errorName === 'UnrecognizedClientException' ||
            errorMessage.includes('InvalidClientTokenId') ||
            errorMessage.includes('SignatureDoesNotMatch') ||
            errorMessage.includes('security token') ||
            errorMessage.includes('AWS credentials are invalid') ||
            // Azure errors
            errorMessage.includes('AADSTS') ||
            errorMessage.includes('invalid_client') ||
            errorMessage.includes('unauthorized_client') ||
            errorMessage.includes('invalid_grant') ||
            errorMessage.includes('AuthenticationFailed') ||
            errorMessage.includes('Azure credentials are invalid') ||
            // GCP errors
            errorMessage.includes('InvalidAuthenticationToken') ||
            errorMessage.includes('GCP credentials are invalid') ||
            errorMessage.includes('deleted from Google Cloud') ||
            // Generic errors
            errorMessage.includes('Unauthorized') ||
            errorMessage.includes('Access denied') ||
            errorMessage.includes('credentials') ||
            errorMessage.includes('authentication') ||
            errorMessage.includes('deleted') ||
            errorMessage.includes('revoked') ||
            errorMessage.includes('No API access available') ||
            errorMessage.includes('no permissions') ||
            errorCode === 401 ||
            errorCode === 403 ||
            error.statusCode === 401;

        return {
            valid: false,
            reason: isCredentialError
                ? 'Credentials are invalid or have been deleted from the cloud provider'
                : error.message,
            connection_status: 'failed',
            isCredentialError
        };
    }
}

/**
 * Handle invalid connection - mark as failed and optionally disconnect
 * @param {Object} config - CloudConfig document
 * @param {Object} validationResult - Validation result
 */
async function handleInvalidConnection(config, validationResult) {
    try {
        const { reason, connection_status, missing_permissions, impact, isCredentialError } = validationResult;

        // If credentials are deleted/invalid, automatically disconnect
        if (isCredentialError) {
            logger.warn(`Automatically disconnecting ${config.provider} for user ${config.userId} - credentials no longer exist`);

            // Delete the cloud configuration
            await CloudConfig.findByIdAndDelete(config._id);

            // Delete all resources for this connection
            const deletedResources = await Resource.deleteMany({
                userId: config.userId,
                provider: config.provider
            });

            logger.info(`Disconnected ${config.provider} for user ${config.userId} - deleted ${deletedResources.deletedCount} resources`);

            // Store notification for user (you can implement a notification system)
            // For now, we'll just log it
            logger.warn(`[USER NOTIFICATION] ${config.provider} credentials for user ${config.userId} no longer exist and have been automatically disconnected`);

            return {
                disconnected: true,
                reason: 'Credentials no longer exist in cloud provider'
            };
        }

        // Otherwise, just mark as failed but keep the connection
        await CloudConfig.findByIdAndUpdate(config._id, {
            status: 'FAILED',
            lastError: reason,
            lastChecked: new Date(),
            connection_status: connection_status || 'failed',
            missing_permissions: missing_permissions || [],
            impact: impact || []
        });

        logger.info(`Marked ${config.provider} connection as FAILED for user ${config.userId}`);

        return {
            disconnected: false,
            reason
        };

    } catch (error) {
        logger.error(`Error handling invalid connection for ${config.provider} user ${config.userId}:`, error);
        throw error;
    }
}

/**
 * Validate all cloud connections
 */
async function validateAllConnections() {
    try {
        logger.info('Starting credential validation for all connections...');

        // Get all connected cloud configurations
        const configs = await CloudConfig.find({ status: 'CONNECTED' });

        if (configs.length === 0) {
            logger.info('No connected cloud configurations to validate');
            return;
        }

        logger.info(`Found ${configs.length} connected cloud configuration(s) to validate`);

        const results = {
            total: configs.length,
            valid: 0,
            invalid: 0,
            disconnected: 0,
            errors: []
        };

        // Validate each connection
        for (const config of configs) {
            try {
                const validationResult = await validateConnection(config);

                if (validationResult.valid) {
                    // Update last checked time and connection status
                    await CloudConfig.findByIdAndUpdate(config._id, {
                        lastChecked: new Date(),
                        connection_status: validationResult.connection_status,
                        missing_permissions: validationResult.missing_permissions,
                        impact: validationResult.impact
                    });
                    results.valid++;
                } else {
                    // Handle invalid connection
                    const handleResult = await handleInvalidConnection(config, validationResult);
                    results.invalid++;

                    if (handleResult.disconnected) {
                        results.disconnected++;
                    }

                    results.errors.push({
                        userId: config.userId,
                        provider: config.provider,
                        reason: handleResult.reason,
                        disconnected: handleResult.disconnected
                    });
                }

            } catch (error) {
                logger.error(`Error validating connection for ${config.provider} user ${config.userId}:`, error);
                results.errors.push({
                    userId: config.userId,
                    provider: config.provider,
                    error: error.message
                });
            }
        }

        logger.info('Credential validation completed:', {
            total: results.total,
            valid: results.valid,
            invalid: results.invalid,
            disconnected: results.disconnected,
            errors: results.errors.length
        });

        if (results.errors.length > 0) {
            logger.warn('Validation errors:', results.errors);
        }

        return results;

    } catch (error) {
        logger.error('Error in validateAllConnections:', error);
        throw error;
    }
}

/**
 * Start periodic credential validation
 */
function startPeriodicValidation() {
    if (validationIntervalId) {
        logger.warn('Credential validation is already running');
        return;
    }

    logger.info(`Starting periodic credential validation (every ${VALIDATION_INTERVAL / 1000 / 60} minutes)`);

    // Run immediately on start
    validateAllConnections().catch(err => {
        logger.error('Error in initial credential validation:', err);
    });

    // Then run periodically
    validationIntervalId = setInterval(() => {
        validateAllConnections().catch(err => {
            logger.error('Error in periodic credential validation:', err);
        });
    }, VALIDATION_INTERVAL);

    logger.info('Periodic credential validation started');
}

/**
 * Stop periodic credential validation
 */
function stopPeriodicValidation() {
    if (validationIntervalId) {
        clearInterval(validationIntervalId);
        validationIntervalId = null;
        logger.info('Periodic credential validation stopped');
    }
}

/**
 * Validate a specific user's connections
 * @param {String} userId - User ID
 */
async function validateUserConnections(userId) {
    try {
        logger.info(`Validating connections for user ${userId}`);

        const configs = await CloudConfig.find({ userId, status: 'CONNECTED' });

        if (configs.length === 0) {
            logger.info(`No connected cloud configurations for user ${userId}`);
            return { valid: [], invalid: [], disconnected: [] };
        }

        const results = {
            valid: [],
            invalid: [],
            disconnected: []
        };

        for (const config of configs) {
            const validationResult = await validateConnection(config);

            if (validationResult.valid) {
                await CloudConfig.findByIdAndUpdate(config._id, {
                    lastChecked: new Date(),
                    connection_status: validationResult.connection_status,
                    missing_permissions: validationResult.missing_permissions,
                    impact: validationResult.impact
                });
                results.valid.push({
                    provider: config.provider,
                    connection_status: validationResult.connection_status
                });
            } else {
                const handleResult = await handleInvalidConnection(config, validationResult);

                if (handleResult.disconnected) {
                    results.disconnected.push({
                        provider: config.provider,
                        reason: handleResult.reason
                    });
                } else {
                    results.invalid.push({
                        provider: config.provider,
                        reason: handleResult.reason
                    });
                }
            }
        }

        return results;

    } catch (error) {
        logger.error(`Error validating connections for user ${userId}:`, error);
        throw error;
    }
}

module.exports = {
    validateConnection,
    validateAllConnections,
    validateUserConnections,
    startPeriodicValidation,
    stopPeriodicValidation
};
