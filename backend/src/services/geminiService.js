const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

let genAI = null;
let model = null;
let fallbackMode = false;

// Fallback strings for when Gemini API is unavailable
const FALLBACK_STRINGS = {
    explanation: "This recommendation was generated based on your VM's usage patterns and current pricing data.",
    advisory: "Insufficient usage data available. Collect more metrics over 7-14 days for a confident recommendation.",
    insight: "This VM is well-configured for its current workload. Consider Reserved Instances or Savings Plans for additional cost reduction.",
    validation: {
        verdict: 'VALID',
        risk_level: 'LOW',
        warnings: [],
        explanation: "AI validation unavailable. Recommendation is based on system analysis."
    }
};

/**
 * Initialize the Gemini service
 * Loads API key from environment and configures the client
 */
function initialize() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        logger.warn('[Gemini] GEMINI_API_KEY not found - operating in fallback-only mode');
        fallbackMode = true;
        return;
    }

    try {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        logger.info('[Gemini] Service initialized successfully');
    } catch (error) {
        logger.error(`[Gemini] Initialization failed: ${error.message}`);
        fallbackMode = true;
    }
}

/**
 * Safe wrapper for Gemini API calls with timeout and error handling
 * @param {Function} callFunction - The async function to execute
 * @param {*} fallbackValue - Value to return on failure
 * @returns {Promise<*>} Result from callFunction or fallbackValue
 */
async function safeGeminiCall(callFunction, fallbackValue) {
    if (fallbackMode) {
        logger.info('[Gemini] Operating in fallback mode - returning fallback value');
        return fallbackValue;
    }

    const startTime = Date.now();

    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 5000)
        );

        const result = await Promise.race([
            callFunction(),
            timeoutPromise
        ]);

        const responseTime = Date.now() - startTime;
        logger.info(`[Gemini] API call completed in ${responseTime}ms`);

        return result;
    } catch (error) {
        const responseTime = Date.now() - startTime;

        if (error.message === 'Timeout') {
            logger.warn(`[Gemini] API call timeout after ${responseTime}ms - using fallback`);
        } else {
            logger.error(`[Gemini] API call failed: ${error.message} - using fallback`);
        }

        return fallbackValue;
    }
}

module.exports = {
    initialize,
    safeGeminiCall,
    FALLBACK_STRINGS,
    // Export for testing
    _getState: () => ({ fallbackMode, hasModel: !!model })
};

/**
 * Generate human-readable explanation for a VM recommendation
 * @param {Object} vmData - VM metrics and configuration
 * @param {Object} recommendation - Recommendation details from ML pipeline
 * @returns {Promise<string>} Explanation text
 */
async function generateExplanation(vmData, recommendation) {
    const callFunction = async () => {
        const prompt = `You are a cloud cost optimization assistant helping engineers understand recommendations.

STRICT RULES:
- Do NOT suggest any instance types
- Do NOT change any numbers or prices
- Do NOT say "I recommend" or "you should switch to"
- Write ONLY 2-3 short, clear sentences
- Write for a non-technical user
- Be factual, not promotional

VM DATA:
- Cloud: ${vmData.cloud || 'unknown'}
- Instance Type: ${vmData.instance_type || 'unknown'}
- CPU Capacity: ${vmData.cpu || 'unknown'} vCPUs
- Memory: ${vmData.memory_gb || 'unknown'} GB
- Average CPU Usage: ${vmData.avg_cpu_util || 'unknown'}%
- P95 CPU Usage: ${vmData.p95_cpu_util || 'unknown'}%
- Average Memory Usage: ${vmData.avg_memory_util || 'unknown'}%
- Current Cost: $${vmData.current_price_per_hour || 0}/hour
- Region: ${vmData.region || 'unknown'}

RECOMMENDATION MADE BY THE SYSTEM:
- Action: ${recommendation.action || 'unknown'}
- Suggested Instance: ${recommendation.suggested_instance || 'unknown'}
- Suggested Cost: $${recommendation.suggested_price_per_hour || 0}/hour
- Monthly Savings: $${recommendation.monthly_savings || 0}
- Risk Level: ${recommendation.risk_level || 'unknown'}

Write the explanation now:`;

        logger.info(`[Gemini] Generating explanation for instance ${vmData.instance_id || 'unknown'}`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    };

    return safeGeminiCall(callFunction, FALLBACK_STRINGS.explanation);
}

/**
 * Validate recommendation and assess risk level
 * @param {Object} vmData - VM metrics and configuration
 * @param {Object} recommendation - Recommendation details from ML pipeline
 * @returns {Promise<Object>} Validation result with verdict, risk_level, warnings
 */
async function validateRecommendation(vmData, recommendation) {
    const callFunction = async () => {
        const prompt = `You are a cloud infrastructure risk checker.

STRICT RULES:
- Do NOT suggest any instance types
- Do NOT change any prices or specs
- Do NOT override the recommendation
- Respond ONLY in the exact JSON format below
- No extra text, no markdown, no explanation outside JSON

RESPOND ONLY WITH THIS JSON:
{
  "verdict": "VALID" or "RISKY",
  "risk_level": "LOW" or "MEDIUM" or "HIGH",
  "warnings": ["warning if any", "another warning if any"],
  "explanation": "one sentence about the risk assessment"
}

DATA TO VALIDATE:
- Current Instance: ${vmData.instance_type} (${vmData.cpu} vCPU, ${vmData.memory_gb}GB RAM)
- Recommended Instance: ${recommendation.suggested_instance}
- Average CPU Usage: ${vmData.avg_cpu_util}%
- P95 CPU Usage: ${vmData.p95_cpu_util}%
- Average Memory Usage: ${vmData.avg_memory_util}%
- Action: ${recommendation.action}
- Monthly Savings: $${recommendation.monthly_savings}
- Risk Level from System: ${recommendation.risk_level}`;

        logger.info(`[Gemini] Validating recommendation for instance ${vmData.instance_id || 'unknown'}`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        // Extract JSON from response
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            return JSON.parse(match[0]);
        }

        return FALLBACK_STRINGS.validation;
    };

    return safeGeminiCall(callFunction, FALLBACK_STRINGS.validation);
}

/**
 * Generate advisory message for low-confidence scenarios
 * @param {Object} vmData - VM metrics and configuration
 * @returns {Promise<string>} Advisory message
 */
async function getAdvisoryMessage(vmData) {
    const callFunction = async () => {
        const prompt = `You are a cloud advisor. The system does not have enough data to make a confident recommendation for this VM.

STRICT RULES:
- Do NOT suggest any specific instance type
- Do NOT give a price or cost estimate
- Write ONE short advisory sentence only
- Be honest that data is limited
- Be helpful and constructive

VM DATA:
- Cloud: ${vmData.cloud || 'unknown'}
- Instance Type: ${vmData.instance_type || 'unknown'}
- Average CPU: ${vmData.avg_cpu_util || 'unknown'}%
- Average Memory: ${vmData.avg_memory_util || 'unknown'}%
- Region: ${vmData.region || 'unknown'}

Write the advisory sentence now:`;

        logger.info(`[Gemini] Generating advisory for instance ${vmData.instance_id || 'unknown'}`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    };

    return safeGeminiCall(callFunction, FALLBACK_STRINGS.advisory);
}

/**
 * Generate positive insight for optimal VMs
 * @param {Object} vmData - VM metrics and configuration
 * @returns {Promise<string>} Insight message
 */
async function getOptimalInsight(vmData) {
    const callFunction = async () => {
        const prompt = `You are a cloud optimization assistant. This VM has been classified as OPTIMAL — it is right-sized.

STRICT RULES:
- Do NOT suggest changing the instance type
- Do NOT suggest downsizing or upsizing
- Write 1-2 sentences confirming it is well-configured
- Optionally mention one non-instance optimization (region, reserved pricing, savings plans)
- Keep it brief and positive

VM DATA:
- Instance: ${vmData.instance_type || 'unknown'}
- CPU Usage: ${vmData.avg_cpu_util || 'unknown'}%
- Memory Usage: ${vmData.avg_memory_util || 'unknown'}%
- Cloud: ${vmData.cloud || 'unknown'}
- Region: ${vmData.region || 'unknown'}

Write now:`;

        logger.info(`[Gemini] Generating optimal insight for instance ${vmData.instance_id || 'unknown'}`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    };

    return safeGeminiCall(callFunction, FALLBACK_STRINGS.insight);
}

module.exports = {
    initialize,
    safeGeminiCall,
    FALLBACK_STRINGS,
    generateExplanation,
    validateRecommendation,
    getAdvisoryMessage,
    getOptimalInsight,
    // Export for testing
    _getState: () => ({ fallbackMode, hasModel: !!model })
};
