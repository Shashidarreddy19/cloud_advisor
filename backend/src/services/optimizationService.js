const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Trigger the full ML inference pipeline (reads PostgreSQL feature views → predicts → saves)
 */
const runPipeline = async () => {
    const res = await axios.post(`${ML_URL}/pipeline/run`);
    return res.data;
};

/**
 * Fetch all stored predictions from vm_sizing_predictions
 * @param {Object} filters - optional { cloud, prediction }
 */
const getPredictions = async (filters = {}) => {
    const params = {};
    if (filters.cloud) params.cloud = filters.cloud;
    if (filters.prediction) params.prediction = filters.prediction;

    const res = await axios.get(`${ML_URL}/pipeline/predictions`, { params });
    return res.data;
};

/**
 * Get cost-aware recommendations (all, or specific instance_id)
 * @param {string|null} instance_id
 */
const getRecommendations = async (instance_id = null) => {
    const params = {};
    if (instance_id) params.instance_id = instance_id;

    const res = await axios.post(`${ML_URL}/pipeline/recommend`, null, { params });
    return res.data;
};

/**
 * Predict multiple VMs from raw normalized data
 * @param {Array} items - List of normalized metric objects
 */
const predictBatch = async (items) => {
    const res = await axios.post(`${ML_URL}/predict/vm/batch`, { items });
    return res.data;
};

/**
 * Enriched batch prediction — classification + PostgreSQL pricing in one call.
 * Each item must include ML features + { cloud, region, instance_type, cost_per_month }.
 * Returns { count, results: [{ prediction, finding, confidence, recommendedType, currentCostPerMonth, savings, recommendation }] }
 */
const predictBatchEnriched = async (items) => {
    const res = await axios.post(`${ML_URL}/predict/csv/batch`, { items }, { timeout: 60000 });
    return res.data;
};

module.exports = { runPipeline, getPredictions, getRecommendations, predictBatch, predictBatchEnriched };
