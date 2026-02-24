const CloudConfig = require('../models/CloudConnection');
const logger = require('../utils/logger');

/**
 * Mark cloud configuration as invalid
 */
const markConfigAsInvalid = async (userId, provider, errorMessage) => {
    try {
        await CloudConfig.findOneAndUpdate(
            { userId, provider },
            {
                status: 'INVALID',
                lastError: errorMessage,
                lastChecked: Date.now()
            }
        );
        logger.warn(`Marked ${provider} config as INVALID for user ${userId}: ${errorMessage}`);
    } catch (error) {
        logger.error(`Failed to mark config as invalid: ${error.message}`);
    }
};

/**
 * Check if error indicates invalid credentials
 */
const isCredentialError = (error) => {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toLowerCase() || '';

    // AWS credential errors
    const awsCredentialErrors = [
        'invalidclienttokenid',
        'signaturedoesnotmatch',
        'accessdenied',
        'unauthorizedoperation',
        'authfailure',
        'invalidaccesskeyid',
        'security token',
        'credentials'
    ];

    // Azure credential errors
    const azureCredentialErrors = [
        'unauthorized',
        'authentication failed',
        'invalid_client',
        'invalid_grant',
        'aadsts',
        'authorization_requestdenied',
        'forbidden'
    ];

    // GCP credential errors
    const gcpCredentialErrors = [
        'unauthenticated',
        'permission denied',
        'invalid_grant',
        'unauthorized',
        'invalid authentication credentials',
        'service account'
    ];

    const allErrors = [...awsCredentialErrors, ...azureCredentialErrors, ...gcpCredentialErrors];

    return allErrors.some(err =>
        errorMessage.includes(err) || errorCode.includes(err)
    );
};

/**
 * Check if error indicates deleted/revoked access
 */
const isAccessRevokedError = (error) => {
    const errorMessage = error.message?.toLowerCase() || '';

    const revokedErrors = [
        'user does not exist',
        'user not found',
        'account disabled',
        'access key does not exist',
        'service principal not found',
        'service account not found',
        'deleted',
        'revoked',
        'disabled'
    ];

    return revokedErrors.some(err => errorMessage.includes(err));
};

/**
 * Handle cloud service errors and update config status
 */
const handleCloudError = async (error, userId, provider) => {
    logger.error(`Cloud service error for ${provider}:`, error.message);

    if (isCredentialError(error) || isAccessRevokedError(error)) {
        await markConfigAsInvalid(userId, provider, error.message);

        // Return a user-friendly error
        return {
            isCredentialError: true,
            message: `Your ${provider} credentials are no longer valid. Please reconnect your account.`,
            originalError: error.message
        };
    }

    // Not a credential error, just a temporary issue
    return {
        isCredentialError: false,
        message: error.message,
        originalError: error.message
    };
};

/**
 * Validate credentials before using them
 */
const validateCredentials = async (userId, provider) => {
    try {
        const config = await CloudConfig.findOne({ userId, provider });

        if (!config) {
            return {
                valid: false,
                message: `No ${provider} configuration found. Please connect your account.`
            };
        }

        if (config.status === 'INVALID') {
            return {
                valid: false,
                message: `Your ${provider} credentials are invalid. Please reconnect your account.`,
                lastError: config.lastError
            };
        }

        return {
            valid: true,
            config
        };
    } catch (error) {
        logger.error(`Failed to validate credentials: ${error.message}`);
        return {
            valid: false,
            message: 'Failed to validate credentials'
        };
    }
};

module.exports = {
    markConfigAsInvalid,
    isCredentialError,
    isAccessRevokedError,
    handleCloudError,
    validateCredentials
};
