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
 * Supports 24-feature enhanced format with backward compatibility
 */
function transformToMLFormat(enrichedVMs) {
    return {
        items: enrichedVMs.map(vm => {
            const cpu_avg = vm.cpu_avg ?? 0;

            return {
                // Original 12 features
                cpu_avg: cpu_avg, // Use 0 if null (will be filtered out)
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

                // New 12 features (with backward compatibility defaults)
                cpu_spike_ratio: vm.cpu_spike_ratio ?? 1.0,
                memory_spike_ratio: vm.memory_spike_ratio ?? 1.0,
                cpu_throttle_percent: vm.cpu_throttle_percent ?? 0.0,
                peak_hour_avg_cpu: vm.peak_hour_avg_cpu ?? cpu_avg,
                off_peak_avg_cpu: vm.off_peak_avg_cpu ?? cpu_avg,
                weekend_avg_cpu: vm.weekend_avg_cpu ?? cpu_avg,
                memory_swap_usage: vm.memory_swap_usage ?? 0.0,
                disk_latency_ms: vm.disk_latency_ms ?? 10.0,
                network_packet_loss: vm.network_packet_loss ?? 0.0,
                data_days: vm.data_days ?? 30,
                granularity_hourly: vm.granularity_hourly ?? 1,
                workload_pattern: vm.workload_pattern ?? 0,

                // Metadata
                cloud: vm.cloud || 'aws',
                region: vm.region || 'us-east-1',
                instance_type: vm.instance_type || 'unknown',
                os: vm.os || vm.os_type || 'Linux' // Include OS for pricing sensitivity
            };
        })
    };
}

/**
 * Apply rule-based classification with strict priority order
 * Priority 1: UNDERSIZED (highest)
 * Priority 2: ZOMBIE (second)
 * Priority 3: OVERSIZED (third)
 * Default: OPTIMAL
 * 
 * @param {Object} vm - VM with metrics
 * @returns {string} Classification: 'Undersized', 'Zombie', 'Oversized', or 'Optimal'
 */
function classifyInstance(vm) {
    // Priority 1: UNDERSIZED (highest priority)
    // Check for resource pressure indicators
    if (vm.cpu_avg > 80 || vm.memory_p95 > 85 ||
        vm.cpu_throttle_percent > 10 || vm.memory_swap_usage > 20) {
        return 'Undersized';
    }

    // Priority 2: ZOMBIE (second priority)
    // Check for idle instances with long uptime
    if (vm.cpu_avg < 5 && vm.uptime_hours > 500) {
        return 'Zombie';
    }

    // Priority 3: OVERSIZED (third priority)
    // Check for underutilized instances
    if (vm.cpu_avg < 20 && vm.memory_avg < 30) {
        return 'Oversized';
    }

    // Default: OPTIMAL
    return 'Optimal';
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

        const mlPrediction = predictionMap[result.prediction] || result.finding || 'Unknown';

        // Apply rule-based classification with strict priority order
        const ruleBasedClassification = classifyInstance(originalVM);

        // Override ML prediction only for high-priority bug fixes:
        // 1. UNDERSIZED instances being labeled as anything else (Bug 5 - Priority 1)
        // 2. ZOMBIE instances being labeled as anything else (Bug 5 - Priority 2)
        // For other cases, trust ML prediction to preserve existing behavior
        let prediction = mlPrediction;

        if (ruleBasedClassification === 'Undersized' && mlPrediction !== 'Undersized') {
            // Bug fix: UNDERSIZED instances must be labeled correctly (highest priority)
            logger.info(`Rule-based classification override for ${originalVM.instance_id}: ML predicted ${mlPrediction}, rules determined ${ruleBasedClassification}`);
            prediction = ruleBasedClassification;
        } else if (ruleBasedClassification === 'Zombie' && mlPrediction !== 'Zombie') {
            // Bug fix: ZOMBIE instances must be labeled correctly (second priority)
            logger.info(`Rule-based classification override for ${originalVM.instance_id}: ML predicted ${mlPrediction}, rules determined ${ruleBasedClassification}`);
            prediction = ruleBasedClassification;
        }
        // For OVERSIZED and OPTIMAL, trust ML prediction to preserve existing+ behavior

        // Check if memory metrics were null in original VM
        const hasMemoryMetrics = originalVM.memory_avg !== null && originalVM.memory_avg !== undefined;

        // Adjust confidence if memory metrics are missing
        let adjustedConfidence = result.confidence;
        if (!hasMemoryMetrics) {
            const confidenceReduction = 0.15; // 15% reduction for missing memory
            adjustedConfidence = Math.max(0, result.confidence - confidenceReduction);
            logger.info(`Reduced confidence for ${originalVM.instance_id} due to missing memory: ${result.confidence.toFixed(2)} -> ${adjustedConfidence.toFixed(2)}`);
        }

        // Determine confidence flag based on adjusted confidence thresholds
        let confidence_flag = null;
        if (adjustedConfidence < 0.50) {
            confidence_flag = 'insufficient';
        } else if (adjustedConfidence < 0.75) {
            confidence_flag = 'low';
        }
        // When confidence >= 0.75, confidence_flag remains null (high confidence)

        // Populate missing_metrics array
        const missing_metrics = [];
        if (originalVM.cpu_avg === null || originalVM.cpu_avg === undefined) {
            missing_metrics.push('cpu_avg');
        }
        if (originalVM.cpu_p95 === null || originalVM.cpu_p95 === undefined) {
            missing_metrics.push('cpu_p95');
        }
        if (originalVM.memory_avg === null || originalVM.memory_avg === undefined) {
            missing_metrics.push('memory_avg');
        }
        if (originalVM.memory_p95 === null || originalVM.memory_p95 === undefined) {
            missing_metrics.push('memory_p95');
        }

        // Calculate data_quality based on data_days
        let data_quality = 'unknown';
        if (originalVM.data_days !== null && originalVM.data_days !== undefined) {
            if (originalVM.data_days >= 30) {
                data_quality = 'high';
            } else if (originalVM.data_days >= 14) {
                data_quality = 'medium';
            } else if (originalVM.data_days >= 7) {
                data_quality = 'low';
            } else {
                data_quality = 'very_low';
            }
        }

        // Calculate granularity based on granularity_hourly
        let granularity = 'unknown';
        if (originalVM.granularity_hourly !== null && originalVM.granularity_hourly !== undefined) {
            granularity = originalVM.granularity_hourly === 1 ? 'hourly' : 'daily';
        }

        // Calculate anomaly_flag based on metrics
        let anomaly_flag = 'none';
        if (originalVM.cpu_avg > 90 && originalVM.memory_p95 > 90) {
            anomaly_flag = 'sustained_overload';
        } else if (originalVM.memory_swap_usage > 50) {
            anomaly_flag = 'memory_crisis';
        } else if (originalVM.cpu_avg < 5 && originalVM.uptime_hours > 500) {
            anomaly_flag = 'zombie_candidate';
        } else if (originalVM.cpu_spike_ratio > 3.0) {
            anomaly_flag = 'spike_contamination';
        }

        // Get model_version from environment or use default
        const model_version = process.env.ML_MODEL_VERSION || 'v2_20250227_143022';

        // Build recommendation object
        // CRITICAL: Do NOT create recommendation when confidence < 0.5
        let recommendation = null;
        let recommendedType = result.recommendedType;
        let recommendedAction = null;
        let savings = result.savings;
        let recommendationText = result.recommendation;
        let performance_risk = null;
        let cost_impact = null;

        // Bug Fix: ZOMBIE instances must get TERMINATE action with 100% savings
        if (prediction === 'Zombie') {
            recommendedType = 'TERMINATE';
            recommendedAction = 'TERMINATE';
            savings = result.currentCostPerMonth || originalVM.cost_per_month || 0;
            recommendationText = `This instance has been idle for ${originalVM.uptime_hours} hours. Recommended action: Terminate to eliminate 100% cost.`;

            recommendation = {
                action: 'terminate',
                suggested_instance: 'TERMINATE',
                suggested_price_per_hour: 0,
                monthly_savings: Math.round(savings * 100) / 100,
                risk_level: 'low'
            };
        } else if (prediction === 'Undersized') {
            // Bug Fix: UNDERSIZED instances show N/A savings and performance risk
            recommendedType = result.recommendedType || 'larger_instance';
            recommendedAction = 'UPSIZE';
            savings = 'N/A';
            performance_risk = 'HIGH';
            cost_impact = 'INCREASE';
            recommendationText = 'Upsizing will increase cost but prevent performance degradation and potential outage.';

            if (adjustedConfidence >= 0.50) {
                recommendation = {
                    action: 'upsize',
                    suggested_instance: result.recommendedType || 'larger_instance',
                    suggested_price_per_hour: result.optimizedCostPerMonth ?
                        Math.round((result.optimizedCostPerMonth / 730) * 1000) / 1000 : null,
                    monthly_savings: 'N/A',
                    risk_level: 'high'
                };
            }
        } else if (adjustedConfidence >= 0.50 && result.recommendedType) {
            const action = prediction === 'Oversized' ? 'downsize' : 'no_action';

            // Calculate risk level based on confidence and savings
            let risk_level = 'low';
            if (adjustedConfidence < 0.75) {
                risk_level = 'medium';
            }
            if (adjustedConfidence < 0.60 || Math.abs(result.savings) > 1000) {
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

            // Map action to recommended_action field
            // Use RESIZE for downsize to match expected output format
            if (action === 'downsize') {
                recommendedAction = 'RESIZE';
            } else if (action === 'no_action') {
                recommendedAction = 'NO ACTION';
            } else {
                recommendedAction = action.toUpperCase();
            }
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
            confidence: adjustedConfidence, // Use adjusted confidence
            confidence_flag,

            // Missing metrics tracking
            missing_metrics,

            // New output fields (Bug 7 fix)
            data_quality,
            granularity,
            anomaly_flag,
            model_version,
            recommended_action: recommendedAction,

            // Performance risk and cost impact (Bug 8 fix)
            performance_risk,
            cost_impact,

            // Pricing - pass through ML service fields directly
            current_price_per_hour: result.currentCostPerMonth ?
                Math.round((result.currentCostPerMonth / 730) * 1000) / 1000 : null,
            current_cost_per_month: result.currentCostPerMonth,
            currentCostPerMonth: result.currentCostPerMonth, // Direct passthrough
            optimizedCostPerMonth: result.optimizedCostPerMonth, // Direct passthrough
            price_source: originalVM.source === 'cloud' ? 'live' : 'estimated',

            // Recommendation - will be null when confidence < 0.5
            recommendation,
            recommendedType: recommendedType, // Use updated recommendedType
            recommended_type: recommendedType, // Add snake_case version for consistency
            savings: savings, // Use updated savings (can be 'N/A' for UNDERSIZED)
            recommendation_text: recommendationText, // Add recommendation_text field

            // ML details - use updated text for ZOMBIE instances
            ml_recommendation_text: recommendationText,

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
 * CRITICAL: Skip ML if CPU metrics (cpu_avg OR cpu_p95) are null, allow ML with null memory (reduced confidence)
 * CRITICAL: Skip ML if uptime_hours < metrics_window_days × 24 (insufficient data period)
 */
async function processVMsWithML(enrichedVMs) {
    // Check if we have any VMs to process
    if (!enrichedVMs || enrichedVMs.length === 0) {
        return [];
    }

    const METRICS_WINDOW_DAYS = parseInt(process.env.METRICS_WINDOW_DAYS) || 30;
    const MIN_UPTIME_HOURS = METRICS_WINDOW_DAYS * 24;

    // Filter VMs: Skip ML if cpu_avg OR cpu_p95 is null OR uptime is insufficient
    const vmsForML = enrichedVMs.filter(vm => {
        const hasCPUAvg = vm.cpu_avg !== null && vm.cpu_avg !== undefined;
        const hasCPUP95 = vm.cpu_p95 !== null && vm.cpu_p95 !== undefined;
        const hasCPU = hasCPUAvg && hasCPUP95;

        // Check uptime requirement
        const uptime = vm.running_hours_last_14d || vm.uptime_hours || 0;
        const hasEnoughUptime = uptime >= MIN_UPTIME_HOURS;

        if (!hasCPU) {
            logger.warn(`Skipping ML for ${vm.instance_id} - CPU metrics missing (cpu_avg: ${hasCPUAvg}, cpu_p95: ${hasCPUP95})`);
            return false;
        }

        if (!hasEnoughUptime) {
            logger.warn(`Skipping ML for ${vm.instance_id} - Insufficient uptime (${uptime}h < ${MIN_UPTIME_HOURS}h required for ${METRICS_WINDOW_DAYS}-day window)`);
            return false;
        }

        return true;
    });

    // VMs without CPU metrics or insufficient uptime get insufficient_data status
    const insufficientDataVMs = enrichedVMs.filter(vm => {
        const hasCPU = (vm.cpu_avg !== null && vm.cpu_avg !== undefined) &&
            (vm.cpu_p95 !== null && vm.cpu_p95 !== undefined);
        const uptime = vm.running_hours_last_14d || vm.uptime_hours || 0;
        const hasEnoughUptime = uptime >= MIN_UPTIME_HOURS;

        return !hasCPU || !hasEnoughUptime;
    }).map(vm => {
        // Populate missing_metrics array
        const missing_metrics = [];
        if (vm.cpu_avg === null || vm.cpu_avg === undefined) {
            missing_metrics.push('cpu_avg');
        }
        if (vm.cpu_p95 === null || vm.cpu_p95 === undefined) {
            missing_metrics.push('cpu_p95');
        }
        if (vm.memory_avg === null || vm.memory_avg === undefined) {
            missing_metrics.push('memory_avg');
        }
        if (vm.memory_p95 === null || vm.memory_p95 === undefined) {
            missing_metrics.push('memory_p95');
        }

        return {
            instance_id: vm.instance_id,
            instance_type: vm.instance_type,
            region: vm.region,
            cloud: vm.cloud,
            status: 'insufficient_data',
            prediction: 'Insufficient Data',
            confidence: 0,
            confidence_flag: 'insufficient',
            recommendation: null,
            missing_metrics,
            metrics: {
                cpu_avg: vm.cpu_avg,
                cpu_p95: vm.cpu_p95,
                memory_avg: vm.memory_avg,
                memory_p95: vm.memory_p95,
                vcpu_count: vm.vcpu_count,
                ram_gb: vm.ram_gb,
                uptime_hours: vm.uptime_hours
            }
        };
    });

    if (vmsForML.length === 0) {
        logger.info('No VMs with sufficient CPU metrics for ML processing');
        return insufficientDataVMs;
    }

    try {
        // Try to get predictions from ML service
        logger.info(`Sending ${vmsForML.length} VMs to ML (${insufficientDataVMs.length} skipped due to missing CPU)`);
        const results = await predictBatch(vmsForML);

        // Note: Confidence adjustment for missing memory is now handled in transformMLResponse
        return [...results, ...insufficientDataVMs];

    } catch (error) {
        logger.error('ML processing failed, returning VMs with error status', {
            error: error.message,
            vmCount: vmsForML.length
        });

        // Return VMs with error status instead of failing completely
        const errorVMs = vmsForML.map(vm => {
            // Populate missing_metrics array for error VMs too
            const missing_metrics = [];
            if (vm.memory_avg === null || vm.memory_avg === undefined) {
                missing_metrics.push('memory_avg');
            }
            if (vm.memory_p95 === null || vm.memory_p95 === undefined) {
                missing_metrics.push('memory_p95');
            }

            return {
                instance_id: vm.instance_id,
                instance_type: vm.instance_type,
                region: vm.region,
                cloud: vm.cloud,
                status: 'ml_service_error',
                error: error.message,
                recommendation: null,
                missing_metrics,
                metrics: {
                    cpu_avg: vm.cpu_avg,
                    cpu_p95: vm.cpu_p95,
                    memory_avg: vm.memory_avg,
                    memory_p95: vm.memory_p95,
                    vcpu_count: vm.vcpu_count,
                    ram_gb: vm.ram_gb,
                    uptime_hours: vm.uptime_hours
                }
            };
        });

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
    transformMLResponse,
    classifyInstance
};
