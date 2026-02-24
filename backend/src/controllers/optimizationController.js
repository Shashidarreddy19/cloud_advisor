const optimizationService = require('../services/optimizationService');
const logger = require('../utils/logger');

/**
 * POST /api/optimize/run
 * Trigger the full ML inference pipeline
 */
const runPipeline = async (req, res) => {
    try {
        logger.info('Optimization pipeline triggered');
        const result = await optimizationService.runPipeline();
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Pipeline run error:', error.message);
        res.status(500).json({ error: 'Failed to run ML pipeline', detail: error.message });
    }
};

/**
 * GET /api/optimize/predictions
 * Returns all persisted predictions, with optional filters
 * Query params: cloud, prediction
 */
const getPredictions = async (req, res) => {
    try {
        const { cloud, prediction } = req.query;
        const result = await optimizationService.getPredictions({ cloud, prediction });
        res.json(result);
    } catch (error) {
        logger.error('Get predictions error:', error.message);
        res.status(500).json({ error: 'Failed to fetch predictions', detail: error.message });
    }
};

/**
 * GET /api/optimize/recommendations
 * Returns cost-aware recommendations for all VMs (or query ?instance_id=...)
 */
const getRecommendations = async (req, res) => {
    try {
        const { instance_id } = req.query;
        const result = await optimizationService.getRecommendations(instance_id || null);
        res.json(result);
    } catch (error) {
        logger.error('Get recommendations error:', error.message);
        res.status(500).json({ error: 'Failed to fetch recommendations', detail: error.message });
    }
};

module.exports = { runPipeline, getPredictions, getRecommendations };
