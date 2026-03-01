const logger = require('../utils/logger');

/**
 * CPU + Memory-Driven Recommendation Engine
 * 
 * Generates rightsizing recommendations based on CPU and memory metrics
 * with proper handling of missing data, free-tier limitations, and instance states.
 */

// Configuration thresholds (can be overridden by environment variables)
const THRESHOLDS = {
    OVERSIZED_CPU_AVG: parseFloat(process.env.OVERSIZED_CPU_AVG_THRESHOLD) || 20,
    OVERSIZED_CPU_P95: parseFloat(process.env.OVERSIZED_CPU_P95_THRESHOLD) || 40,
    OVERSIZED_MEMORY_AVG: parseFloat(process.env.OVERSIZED_MEMORY_AVG_THRESHOLD) || 30,
    OVERSIZED_MEMORY_P95: parseFloat(process.env.OVERSIZED_MEMORY_P95_THRESHOLD) || 50,
    UNDERSIZED_CPU_P95: parseFloat(process.env.UNDERSIZED_CPU_P95_THRESHOLD) || 80,
    UNDERSIZED_MEMORY_P95: parseFloat(process.env.UNDERSIZED_MEMORY_P95_THRESHOLD) || 80,
    MIN_CONFIDENCE_DISPLAY: parseFloat(process.env.MIN_CONFIDENCE_DISPLAY) || 0.50,
    LOW_CONFIDENCE_THRESHOLD: parseFloat(process.env.LOW_CONFIDENCE_THRESHOLD) || 0.75
};

/**
 * Main function to generate recommendation for an instance
 * @param {Object} instance - Cloud instance with metrics
 * @returns {Object} Recommendation result with confidence and warnings
 */
function generateRecommendation(instance) {
    try {
        // Validate required fields
        if (!instance || !instance.state) {
            logger.warn('generateRecommendation: Missing required instance fields');
            return {
                recommendation: null,
                confidence: null,
                warnings: [],
                metrics_window_days: null,
                memory_status: 'unavailable'
            };
        }

        // Check eligibility
        if (!isEligibleForRecommendation(instance)) {
            return {
                recommendation: null,
                confidence: null,
                warnings: [],
                metrics_window_days: instance.metrics_window_days || null,
                memory_status: instance.memory_metrics_source || 'unavailable'
            };
        }

        // Classify instance
        const classification = classifyInstance(instance);

        // Calculate confidence
        const confidence = calculateConfidence(instance);

        // Generate warnings
        const warnings = generateWarnings(instance, confidence);

        // Filter by confidence threshold
        if (confidence < THRESHOLDS.MIN_CONFIDENCE_DISPLAY) {
            return {
                recommendation: null,
                confidence: null,
                warnings: [],
                metrics_window_days: instance.metrics_window_days || null,
                memory_status: instance.memory_metrics_source || 'unavailable'
            };
        }

        return {
            recommendation: classification,
            confidence: confidence,
            warnings: warnings,
            metrics_window_days: instance.metrics_window_days || null,
            memory_status: instance.memory_metrics_source || 'unavailable'
        };

    } catch (error) {
        logger.error(`Recommendation generation failed: ${error.message}`, { error, instanceId: instance.resourceId });
        return {
            recommendation: null,
            confidence: null,
            warnings: [],
            error: error.message
        };
    }
}

/**
 * Check if instance is eligible for recommendation
 * @param {Object} instance - Cloud instance
 * @returns {boolean} True if eligible
 */
function isEligibleForRecommendation(instance) {
    // Requirement 5.1: Instance must be RUNNING
    const state = (instance.state || '').toLowerCase();
    if (state !== 'running') {
        return false;
    }

    // Requirement 5.2: Must have at least 7 days uptime
    const uptime_days = (instance.running_hours_last_14d || 0) / 24;
    if (uptime_days < 7) {
        return false;
    }

    // Requirements 5.3, 5.4: CPU metrics must be available
    if (instance.cpu_avg === null || instance.cpu_avg === undefined ||
        instance.cpu_p95 === null || instance.cpu_p95 === undefined) {
        return false;
    }

    // Requirement 5.5: Memory agent not installed is OK (reduced confidence)
    return true;
}

/**
 * Classify instance as OVERSIZED, UNDERSIZED, or OPTIMAL
 * @param {Object} instance - Cloud instance with metrics
 * @returns {string} Classification result
 */
function classifyInstance(instance) {
    const { cpu_avg, cpu_p95, memory_avg, memory_p95, memory_metrics_source } = instance;

    const memoryAvailable = memory_metrics_source === 'available' &&
        memory_avg !== null && memory_avg !== undefined &&
        memory_p95 !== null && memory_p95 !== undefined;

    // Requirement 7.1, 7.2: UNDERSIZED check (either CPU or memory exceeds threshold)
    if (cpu_p95 > THRESHOLDS.UNDERSIZED_CPU_P95) {
        return 'UNDERSIZED';
    }

    if (memoryAvailable && memory_p95 > THRESHOLDS.UNDERSIZED_MEMORY_P95) {
        return 'UNDERSIZED';
    }

    // Requirement 6.1, 6.2, 6.3: OVERSIZED check
    if (memoryAvailable) {
        // Requirement 6.1: Both CPU and memory required when memory available
        if (cpu_avg < THRESHOLDS.OVERSIZED_CPU_AVG &&
            cpu_p95 < THRESHOLDS.OVERSIZED_CPU_P95 &&
            memory_avg < THRESHOLDS.OVERSIZED_MEMORY_AVG &&
            memory_p95 < THRESHOLDS.OVERSIZED_MEMORY_P95) {
            return 'OVERSIZED';
        }
    } else {
        // Requirement 6.2: CPU only when memory agent not installed
        if (cpu_avg < THRESHOLDS.OVERSIZED_CPU_AVG &&
            cpu_p95 < THRESHOLDS.OVERSIZED_CPU_P95) {
            return 'OVERSIZED';
        }
    }

    // Requirement 8.1, 8.2: OPTIMAL (not oversized and not undersized)
    return 'OPTIMAL';
}

/**
 * Calculate confidence score for recommendation
 * @param {Object} instance - Cloud instance with metrics
 * @returns {number} Confidence score (0.0 to 1.0)
 */
function calculateConfidence(instance) {
    const { memory_metrics_source, metrics_window_days } = instance;

    // Requirement 9.2, 9.3: Metrics completeness
    let metrics_completeness;
    if (memory_metrics_source === 'available') {
        metrics_completeness = 1.0;
    } else {
        metrics_completeness = 0.7;
    }

    // Requirement 9.4, 9.5, 9.6: Uptime score
    let uptime_score;
    if (metrics_window_days >= 30) {
        uptime_score = 1.0;
    } else if (metrics_window_days >= 14) {
        uptime_score = 0.7;
    } else {
        uptime_score = 0.5;
    }

    // Rule match strength (simplified - can be enhanced based on how strongly thresholds are met)
    const rule_match_strength = 1.0;

    // Requirement 9.1: Calculate confidence
    let confidence = (metrics_completeness * 0.4) + (uptime_score * 0.3) + (rule_match_strength * 0.3);

    // Requirement 9.7: Reduce confidence by 0.3 if memory agent not installed
    if (memory_metrics_source !== 'available') {
        confidence = Math.max(0, confidence - 0.3);
    }

    return confidence;
}

/**
 * Generate warnings for recommendation
 * @param {Object} instance - Cloud instance
 * @param {number} confidence - Confidence score
 * @returns {Array<string>} Array of warning messages
 */
function generateWarnings(instance, confidence) {
    const warnings = [];

    // Requirement 13.1, 13.2: Memory agent missing warning
    if (instance.memory_metrics_source !== 'available') {
        warnings.push('Memory agent not detected. Recommendation based on CPU only.');
    }

    // Requirement 10.2: Low confidence warning
    if (confidence >= THRESHOLDS.MIN_CONFIDENCE_DISPLAY &&
        confidence < THRESHOLDS.LOW_CONFIDENCE_THRESHOLD) {
        warnings.push('Low confidence');
    }

    return warnings;
}

module.exports = {
    generateRecommendation,
    isEligibleForRecommendation,
    classifyInstance,
    calculateConfidence,
    generateWarnings,
    THRESHOLDS
};
