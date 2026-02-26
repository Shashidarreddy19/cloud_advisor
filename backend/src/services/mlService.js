const axios = require('axios');
const logger = require('../utils/logger');

/**
 * ML Service Client
 * Handles communication with Python/FastAPI ML service
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ML_TIMEOUT = 60000; // 60 seconds

/**
 * Transform enriched VM data to ML service format
 * CRITICAL: Preserve null for missing memory, use 0 for missing CPU (skip ML)
 */
function transformToMLFormat(enrichedVMs) {
    return {
        items: enrichedVMs.map(vm => ({
            cpu_avg: vm.cpu_avg ?? 0, // Use 0 if null (will be filtered out)
            cpu_p95: vm.cpu_p95 ?? 0,
            memory_avg: vm.memory_avg ?? null, // Preserve null - ML can handle missing memory
            memory_p95: vm.memory_p95 ?? null, // Preserve null
            disk_read_iops: vm.disk_read_iops || 0,
            disk_write_iops: vm.disk_write_iops || 0,
            network_in_bytes: vm.network_in_bytes || 0,
            network_out_bytes: vm.network_out_bytes || 0,
            vcpu_count: vm.vcpu_count || 2,
            ram_gb: vm.ram_gb || 4,
            uptime_hours: vm.uptime_hours || 720,
            cost_per_month: vm.cost_per_month || 0,
            cloud: vm.cloud || 'aws',
            region: vm.region || 'us-east-1',
            instance_type: vm.instance_type || 'unknown',
            os: vm.os || vm.os_type || 'Linux' // Include OS for pricing sensitivity
        }))
    };
}

/**
 * Transform ML service response back to our format
 */
function transformMLResponse(mlResponse, originalVMs) {
    if (!mlResponse || !mlResponse.results) {
        throw new Error('Invalid ML service response');
    }

    return mlResponse.results.map((result, index) => {
        const originalVM = originalVMs[index];

        // Map prediction number to status
        const predictionMap = {
            0: 'Optimal',
            1: 'Oversized',
            2: 'Undersized'
        };

        const prediction = predictionMap[result.prediction] || result.finding || 'Unknown';

        // Determine confidence flag
        let confidence_flag = null;
        if (result.confidence < 0.50) {
            confidence_flag = 'insufficient';
        } else if (result.confidence < 0.75) {
            confidence_flag = 'low';
        }

        // Build recommendation object
        let recommendation = null;
        if (confidence_flag !== 'insufficient' && result.recommendedType) {
            const action = prediction === 'Oversized' ? 'downsize' :
                prediction === 'Undersized' ? 'upsize' : 'no_action';

            // Calculate risk level based on confidence and savings
            let risk_level = 'low';
            if (result.confidence < 0.75) {
                risk_level = 'medium';
            }
            if (result.confidence < 0.60 || Math.abs(result.savings) > 1000) {
                risk_level = 'high';
            }

            recommendation = {
                action,
                suggested_instance: result.recommendedType,
                suggested_price_per_hour: result.optimizedCostPerMonth ?
                    Math.round((result.optimizedCostPerMonth / 730) * 1000) / 1000 : null,
                monthly_savings: Math.round(result.savings * 100) / 100,
                risk_level
            };
        }

        return {
            instance_id: originalVM.instance_id,
            instance_type: originalVM.instance_type,
            region: originalVM.region,
            cloud: originalVM.cloud,
            account_id: originalVM.account_id,
            os: originalVM.os,

            // Status
            status: confidence_flag === 'insufficient' ? 'insufficient_data' : 'analyzed',
            prediction,
            confidence: result.confidence,
            confidence_flag,

            // Pricing - pass through ML service fields directly
            current_price_per_hour: result.currentCostPerMonth ?
                Math.round((result.currentCostPerMonth / 730) * 1000) / 1000 : null,
            current_cost_per_month: result.currentCostPerMonth,
            currentCostPerMonth: result.currentCostPerMonth, // Direct passthrough
            optimizedCostPerMonth: result.optimizedCostPerMonth, // Direct passthrough
            price_source: originalVM.source === 'cloud' ? 'live' : 'estimated',

            // Recommendation
            recommendation,
            recommendedType: result.recommendedType, // Direct passthrough
            savings: result.savings, // Direct passthrough from ML service

            // ML details
            ml_recommendation_text: result.recommendation,

            // Original metrics
            metrics: {
                cpu_avg: originalVM.cpu_avg,
                cpu_p95: originalVM.cpu_p95,
                memory_avg: originalVM.memory_avg,
                memory_p95: originalVM.memory_p95,
                vcpu_count: originalVM.vcpu_count,
                ram_gb: originalVM.ram_gb,
                uptime_hours: originalVM.uptime_hours
            }
        };
    });
}

/**
 * Call ML service for batch prediction
 */
async function predictBatch(enrichedVMs) {
    try {
        logger.info(`Sending ${enrichedVMs.length} VMs to ML service`);

        const mlRequest = transformToMLFormat(enrichedVMs);

        const response = await axios.post(
            `${ML_SERVICE_URL}/predict/csv/batch`,
            mlRequest,
            {
                timeout: ML_TIMEOUT,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status !== 200) {
            throw new Error(`ML service returned status ${response.status}`);
        }

        logger.info(`ML service processed ${response.data.count} VMs successfully`);

        return transformMLResponse(response.data, enrichedVMs);

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            logger.error('ML service is not available', { url: ML_SERVICE_URL });
            throw new Error('ML service is unavailable. Please ensure the ML service is running.');
        }

        if (error.response) {
            logger.error('ML service error', {
                status: error.response.status,
                data: error.response.data
            });
            throw new Error(`ML service error: ${error.response.data.detail || error.message}`);
        }

        logger.error('Failed to call ML service', { error: error.message });
        throw error;
    }
}

/**
 * Check ML service health
 */
async function checkHealth() {
    try {
        const response = await axios.get(`${ML_SERVICE_URL}/health`, {
            timeout: 5000
        });

        return {
            available: true,
            status: response.data.status,
            model_loaded: response.data.model_loaded,
            postgres_connected: response.data.postgres_connected
        };
    } catch (error) {
        logger.warn('ML service health check failed', { error: error.message });
        return {
            available: false,
            error: error.message
        };
    }
}

/**
 * Process VMs with error handling and fallback
 * CRITICAL: Skip ML if CPU is null, allow ML with null memory (reduced confidence)
 */
async function processVMsWithML(enrichedVMs) {
    // Check if we have any VMs to process
    if (!enrichedVMs || enrichedVMs.length === 0) {
        return [];
    }

    // Filter VMs: Skip ML if CPU is null (insufficient data)
    const vmsForML = enrichedVMs.filter(vm => {
        const hasCPU = vm.cpu_avg !== null && vm.cpu_avg !== undefined;
        if (!hasCPU) {
            logger.warn(`Skipping ML for ${vm.instance_id} - CPU metrics missing`);
        }
        return hasCPU;
    });

    // VMs without CPU metrics get insufficient_data status
    const insufficientDataVMs = enrichedVMs.filter(vm =>
        vm.cpu_avg === null || vm.cpu_avg === undefined
    ).map(vm => ({
        instance_id: vm.instance_id,
        instance_type: vm.instance_type,
        region: vm.region,
        cloud: vm.cloud,
        status: 'insufficient_data',
        prediction: 'Insufficient Data',
        confidence: 0,
        confidence_flag: 'insufficient',
        recommendation: null,
        metrics: {
            cpu_avg: vm.cpu_avg,
            cpu_p95: vm.cpu_p95,
            memory_avg: vm.memory_avg,
            memory_p95: vm.memory_p95,
            vcpu_count: vm.vcpu_count,
            ram_gb: vm.ram_gb,
            uptime_hours: vm.uptime_hours
        }
    }));

    if (vmsForML.length === 0) {
        logger.info('No VMs with sufficient CPU metrics for ML processing');
        return insufficientDataVMs;
    }

    try {
        // Try to get predictions from ML service
        logger.info(`Sending ${vmsForML.length} VMs to ML (${insufficientDataVMs.length} skipped due to missing CPU)`);
        const results = await predictBatch(vmsForML);

        // Reduce confidence by 10-20% for VMs with null memory
        const adjustedResults = results.map(result => {
            const originalVM = vmsForML.find(vm => vm.instance_id === result.instance_id);
            if (originalVM && (originalVM.memory_avg === null || originalVM.memory_avg === undefined)) {
                const confidenceReduction = 0.15; // 15% reduction
                const adjustedConfidence = Math.max(0, result.confidence - confidenceReduction);
                logger.info(`Reduced confidence for ${result.instance_id} due to missing memory: ${result.confidence.toFixed(2)} -> ${adjustedConfidence.toFixed(2)}`);
                return {
                    ...result,
                    confidence: adjustedConfidence,
                    confidence_flag: adjustedConfidence < 0.50 ? 'insufficient' :
                        adjustedConfidence < 0.75 ? 'low' : null
                };
            }
            return result;
        });

        return [...adjustedResults, ...insufficientDataVMs];

    } catch (error) {
        logger.error('ML processing failed, returning VMs with error status', {
            error: error.message,
            vmCount: vmsForML.length
        });

        // Return VMs with error status instead of failing completely
        const errorVMs = vmsForML.map(vm => ({
            instance_id: vm.instance_id,
            instance_type: vm.instance_type,
            region: vm.region,
            cloud: vm.cloud,
            status: 'ml_service_error',
            error: error.message,
            recommendation: null,
            metrics: {
                cpu_avg: vm.cpu_avg,
                cpu_p95: vm.cpu_p95,
                memory_avg: vm.memory_avg,
                memory_p95: vm.memory_p95,
                vcpu_count: vm.vcpu_count,
                ram_gb: vm.ram_gb,
                uptime_hours: vm.uptime_hours
            }
        }));

        return [...errorVMs, ...insufficientDataVMs];
    }
}

/**
 * Process VMs in batches to avoid overwhelming the ML service
 */
async function processVMsInBatches(enrichedVMs, batchSize = 100) {
    const results = [];

    for (let i = 0; i < enrichedVMs.length; i += batchSize) {
        const batch = enrichedVMs.slice(i, i + batchSize);
        logger.info(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(enrichedVMs.length / batchSize)}`);

        const batchResults = await processVMsWithML(batch);
        results.push(...batchResults);
    }

    return results;
}

module.exports = {
    predictBatch,
    checkHealth,
    processVMsWithML,
    processVMsInBatches,
    transformToMLFormat,
    transformMLResponse
};
