const cron = require('node-cron');
const CSVUpload = require('../models/CSVUpload');
const logger = require('../utils/logger');

/**
 * Clean up orphaned CSV data older than 24 hours
 * Runs as a background job every 6 hours
 */
const cleanupOrphanedData = async () => {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    try {
        // Delete old CSV uploads
        const result = await CSVUpload.deleteMany({
            uploadDate: { $lt: cutoffTime },
            status: 'processed' // Only cleanup processed uploads
        });

        logger.info(`[Background Cleanup] Removed ${result.deletedCount} orphaned CSV records`, {
            recordsRemoved: result.deletedCount,
            timestamp: new Date().toISOString(),
            cutoffTime: cutoffTime.toISOString()
        });

        return {
            recordsRemoved: result.deletedCount,
            timestamp: new Date()
        };
    } catch (error) {
        logger.error('[Background Cleanup] Error:', {
            operation: 'background-cleanup',
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        // Don't throw - let job continue on next schedule
        return {
            recordsRemoved: 0,
            timestamp: new Date(),
            errors: [error.message]
        };
    }
};

/**
 * Start the background cleanup job
 * Runs every 6 hours
 */
const startCleanupJob = () => {
    // Run every 6 hours
    const schedule = '0 */6 * * *';

    cron.schedule(schedule, async () => {
        logger.info('[Background Cleanup] Job triggered');
        await cleanupOrphanedData();
    });

    logger.info('[Background Cleanup] Job started, running every 6 hours');
};

module.exports = { startCleanupJob, cleanupOrphanedData };
