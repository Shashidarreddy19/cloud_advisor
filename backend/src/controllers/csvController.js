const fileService = require('../services/fileService');
const { normalizeVM, autoDetectColumns, validateRequiredColumns, NormalizationError } = require('../services/normalizationService');
const { enrichVMBatch } = require('../services/enrichmentService');
const { processVMsInBatches } = require('../services/mlService');
const geminiService = require('../services/geminiService');
const CSVUpload = require('../models/CSVUpload');
const Report = require('../models/Report');
const User = require('../models/User');
const logger = require('../utils/logger');

const uploadCsv = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        logger.info('Processing CSV file', { filename: req.file.originalname });

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Upsert upload record
        let csvUpload = await CSVUpload.findOne({ userId: user._id, originalName: req.file.originalname });
        if (csvUpload) {
            csvUpload.status = 'pending';
            csvUpload.uploadDate = new Date();
            await csvUpload.save();
        } else {
            csvUpload = new CSVUpload({
                userId: user._id,
                filename: req.file.filename,
                originalName: req.file.originalname,
                path: req.file.path,
                size: req.file.size,
                status: 'pending',
            });
            await csvUpload.save();
        }

        // Parse CSV
        const rawData = await fileService.parseFile(req.file);
        if (!rawData || rawData.length === 0) {
            return res.status(400).json({ error: 'CSV file is empty or invalid' });
        }

        // Strip blank rows
        const filteredRaw = rawData.filter(row => {
            const values = Object.values(row);
            return values.some(v => v !== null && v !== undefined && String(v).trim() !== '');
        });

        if (filteredRaw.length === 0) {
            return res.status(400).json({ error: 'CSV file contains no valid data rows' });
        }

        logger.info(`Processing ${filteredRaw.length} rows from CSV`);

        // Validate columns
        const headers = Object.keys(filteredRaw[0]);
        const validation = validateRequiredColumns(headers);

        if (!validation.valid) {
            // Check if we can auto-detect columns
            const { mappings, unmapped } = autoDetectColumns(headers);

            if (Object.keys(mappings).length < 3) {
                // Not enough columns detected, need user mapping
                return res.status(400).json({
                    status: 'needs_mapping',
                    message: validation.message,
                    missing: validation.missing,
                    columns: headers,
                    detected: mappings
                });
            }
        }

        // STEP 1: Normalize all VMs
        const normalizedVMs = [];
        const errors = [];

        for (let i = 0; i < filteredRaw.length; i++) {
            try {
                const normalized = normalizeVM(filteredRaw[i], 'file');
                normalizedVMs.push(normalized);
            } catch (error) {
                logger.warn(`Normalization failed for row ${i + 1}`, { error: error.message });
                errors.push({
                    row: i + 1,
                    error: error.message,
                    data: filteredRaw[i]
                });

                // Add error record to results
                normalizedVMs.push({
                    instance_id: filteredRaw[i].instance_id || `row-${i + 1}`,
                    instance_type: filteredRaw[i].instance_type || 'unknown',
                    region: filteredRaw[i].region || 'unknown',
                    status: 'normalization_error',
                    error: error.message
                });
            }
        }

        logger.info(`Normalized ${normalizedVMs.length} VMs, ${errors.length} errors`);

        // STEP 2: Enrich VMs (only those that normalized successfully)
        const vmsToEnrich = normalizedVMs.filter(vm => !vm.status || vm.status !== 'normalization_error');
        const enrichedVMs = await enrichVMBatch(vmsToEnrich);

        logger.info(`Enriched ${enrichedVMs.length} VMs`);

        // STEP 3: Call ML service for predictions
        let mlResults = [];

        try {
            mlResults = await processVMsInBatches(enrichedVMs, 100);
            logger.info(`Received ${mlResults.length} predictions from ML service`);
        } catch (mlError) {
            logger.error('ML Service Error', { error: mlError.message });
            return res.status(503).json({
                error: 'ML Service Required',
                message: 'The ML service is not available or failed to process the request.',
                details: mlError.message,
            });
        }

        // STEP 3.5: Add Gemini AI analysis
        const resultsWithAI = await Promise.all(mlResults.map(async (result) => {
            let aiAnalysis = null;

            try {
                // Skip Gemini for error statuses
                if (result.status === 'unresolvable' || result.status === 'normalization_error') {
                    return { ...result, ai_analysis: null };
                }

                // Determine which Gemini function to call based on VM status
                if (result.prediction === 'Optimal') {
                    const message = await geminiService.getOptimalInsight(result);
                    aiAnalysis = {
                        type: 'insight',
                        message: message,
                        verdict: 'VALID',
                        risk_level: 'LOW',
                        warnings: []
                    };
                } else if (result.status === 'insufficient_data' || result.confidence < 0.50) {
                    const message = await geminiService.getAdvisoryMessage(result);
                    aiAnalysis = {
                        type: 'advisory',
                        message: message,
                        verdict: null,
                        risk_level: null,
                        warnings: []
                    };
                } else if (result.recommendation) {
                    // Valid recommendation - get explanation and validation
                    const explanation = await geminiService.generateExplanation(result, result.recommendation);
                    const validation = await geminiService.validateRecommendation(result, result.recommendation);

                    aiAnalysis = {
                        type: 'full',
                        explanation: explanation,
                        verdict: validation.verdict,
                        risk_level: validation.risk_level,
                        warnings: validation.warnings || [],
                        message: explanation
                    };
                }
            } catch (error) {
                logger.error('[Gemini] Failed to generate AI analysis', {
                    instance_id: result.instance_id,
                    error: error.message
                });
                // Continue without AI analysis - don't block the pipeline
            }

            return {
                ...result,
                ai_analysis: aiAnalysis
            };
        }));

        // STEP 4: Combine results (ML results with AI + error records)
        const errorRecords = normalizedVMs.filter(vm => vm.status === 'normalization_error');
        const allResults = [...resultsWithAI, ...errorRecords];

        // STEP 5: Transform to frontend format
        const frontendResults = allResults.map((result, i) => {
            // Handle error records
            if (result.status === 'normalization_error' || result.status === 'ml_service_error') {
                return {
                    id: result.instance_id || `error-${i}`,
                    name: result.instance_id || `Error ${i + 1}`,
                    cloud: result.cloud || 'unknown',
                    region: result.region || 'unknown',
                    resourceType: 'vm',
                    finding: 'Error',
                    instanceType: result.instance_type || 'unknown',
                    recommendedType: null,
                    confidence: 0,
                    cpuUsage: 0,
                    memUsage: 0,
                    savings: null,
                    costPerMonth: 0,
                    optimizedCostPerMonth: 0,
                    recommendation: result.error || 'Processing error',
                    status: result.status,
                    aiAnalysis: null
                };
            }

            // Handle successful ML results
            const finding = result.prediction || 'Optimal';
            const instanceType = result.instance_type || 'unknown';
            const recType = result.recommendedType || result.recommendation?.suggested_instance || instanceType;
            const savings = result.savings || result.recommendation?.monthly_savings || 0;
            const costMonth = result.currentCostPerMonth || result.current_cost_per_month || 0;
            const optimizedCostMonth = result.optimizedCostPerMonth || (result.recommendation?.suggested_instance ?
                (costMonth - savings) : costMonth);

            let recommendation = result.ml_recommendation_text;
            if (!recommendation) {
                if (finding === 'Optimal') {
                    recommendation = 'Resource is optimally provisioned — no action required.';
                } else if (finding === 'Oversized') {
                    if (!recType || recType === instanceType) {
                        recommendation = 'No smaller instance available in this region';
                    } else {
                        recommendation = `Oversized — downsize from ${instanceType} to ${recType} and save $${savings.toFixed(2)}/mo.`;
                    }
                } else if (finding === 'Undersized') {
                    if (!recType || recType === instanceType) {
                        recommendation = 'No larger instance available in this region';
                    } else {
                        recommendation = `Undersized — upgrade from ${instanceType} to ${recType} for better performance.`;
                    }
                }
            }

            return {
                id: result.instance_id || `resource-${i + 1}`,
                name: result.instance_id || `Resource ${i + 1}`,
                cloud: result.cloud || 'aws',
                region: result.region || 'us-east-1',
                resourceType: 'vm',
                finding,
                instanceType,
                recommendedType: recType,
                confidence: result.confidence || 0,
                confidenceFlag: result.confidence_flag,
                cpuUsage: Math.round(result.metrics?.cpu_avg || 0),
                memUsage: Math.round(result.metrics?.memory_avg || 0),
                savings,
                costPerMonth: costMonth,
                optimizedCostPerMonth: optimizedCostMonth,
                recommendation,
                priceSource: result.price_source || 'estimated',
                status: result.status,
                aiAnalysis: result.ai_analysis || null,
                dataQuality: result.data_quality,
                granularity: result.granularity,
                anomalyFlag: result.anomaly_flag,
                modelVersion: result.model_version,
                recommendedAction: result.recommended_action,
                performanceRisk: result.performance_risk,
                costImpact: result.cost_impact
            };
        });

        // DO NOT save to MongoDB yet - only save when user clicks "Save Report"
        // Mark upload as processed in memory only
        csvUpload.status = 'processed';
        csvUpload.processedRecords = frontendResults.length;
        // await csvUpload.save(); // REMOVED - only save when user explicitly saves report

        logger.info(`Returning ${frontendResults.length} recommendations to frontend (not saved to DB yet)`);

        return res.json({
            success: true,
            count: frontendResults.length,
            results: frontendResults,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        logger.error('CSV Upload Error', { error: error.message, stack: error.stack });

        if (req.file) {
            try {
                const user = await User.findById(req.user._id);
                if (user) {
                    const upload = await CSVUpload.findOne({
                        userId: user._id,
                        originalName: req.file.originalname,
                    });
                    if (upload) {
                        upload.status = 'failed';
                        await upload.save();
                    }
                }
            } catch (dbErr) {
                logger.error('Failed to update upload status', { error: dbErr.message });
            }
        }

        return res.status(500).json({
            error: error.message || 'Failed to process CSV file',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * Cleanup CSV recommendations for user
 * DELETE /api/csv/cleanup
 */
const cleanup = async (req, res) => {
    try {
        const { userId, mode } = req.body;

        // Verify user matches authenticated user
        if (userId !== req.user._id.toString()) {
            logger.warn(`[Cleanup] Unauthorized cleanup attempt by user ${req.user._id} for user ${userId}`);
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Only cleanup CSV mode data
        if (mode !== 'csv') {
            logger.info(`[Cleanup] No cleanup needed for ${mode} mode`);
            return res.json({
                success: true,
                deletedCount: 0,
                message: 'No cleanup needed for Cloud mode'
            });
        }

        // Delete CSV uploads
        const result = await CSVUpload.deleteMany({
            userId: userId,
            mode: 'csv'
        });

        logger.info(`[Cleanup] User ${userId} - deleted ${result.deletedCount} CSV records at ${new Date().toISOString()}`);

        res.json({
            success: true,
            deletedCount: result.deletedCount,
            message: 'CSV data cleaned up successfully'
        });
    } catch (error) {
        logger.error('[Cleanup] Error:', {
            operation: 'csv-cleanup',
            userId: req.body.userId,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        res.status(500).json({
            error: 'Cleanup failed',
            details: error.message
        });
    }
};

/**
 * Save recommendations as a persistent report
 * POST /api/csv/save-report
 */
const saveReport = async (req, res) => {
    try {
        const { userId, name, type, recommendations } = req.body;

        // Verify user
        if (userId !== req.user._id.toString()) {
            logger.warn(`[Save Report] Unauthorized save attempt by user ${req.user._id} for user ${userId}`);
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Calculate summary statistics
        const summary = {
            totalRecommendations: recommendations.length,
            totalSavings: recommendations.reduce((sum, r) => sum + (r.savings || 0), 0),
            oversizedCount: recommendations.filter(r => (r.finding || '').toUpperCase() === 'OVERSIZED').length,
            undersizedCount: recommendations.filter(r => (r.finding || '').toUpperCase() === 'UNDERSIZED').length,
            optimalCount: recommendations.filter(r => (r.finding || '').toUpperCase() === 'OPTIMAL').length,
            avgConfidence: recommendations.length > 0
                ? recommendations.reduce((sum, r) => sum + (r.confidence || 0), 0) / recommendations.length
                : 0
        };

        // Create report
        const report = new Report({
            userId,
            name: name || `Report - ${new Date().toISOString()}`,
            type: type || 'CSV',
            status: 'Generated',
            recommendations,
            summary,
            generatedAt: new Date()
        });

        await report.save();

        logger.info(`[Save Report] User ${userId} - saved report ${report._id} at ${new Date().toISOString()}`);

        res.json({
            success: true,
            reportId: report._id,
            message: 'Report saved successfully'
        });
    } catch (error) {
        logger.error('[Save Report] Error:', {
            operation: 'save-report',
            userId: req.body.userId,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV
        });

        res.status(500).json({
            error: 'Failed to save report',
            message: 'Your recommendations are still available. Please try saving again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Provide timestamp range for CSV with missing timestamp column
 * POST /api/csv/provide-timestamp
 */
const provideTimestamp = async (req, res) => {
    try {
        const { userId, uploadId, timeRange } = req.body;

        // Verify user matches authenticated user
        if (userId !== req.user._id.toString()) {
            logger.warn(`[Provide Timestamp] Unauthorized attempt by user ${req.user._id} for user ${userId}`);
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Validate timeRange
        let dataDays;
        if (timeRange === '7') {
            dataDays = 7;
        } else if (timeRange === '14') {
            dataDays = 14;
        } else if (timeRange === '30') {
            dataDays = 30;
        } else if (typeof timeRange === 'number' && timeRange > 0) {
            dataDays = timeRange;
        } else {
            return res.status(400).json({ error: 'Invalid time range. Must be "7", "14", "30", or a positive number.' });
        }

        // Retrieve the CSV upload record
        const csvUpload = await CSVUpload.findById(uploadId);
        if (!csvUpload) {
            return res.status(404).json({ error: 'Upload not found' });
        }

        if (csvUpload.userId.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (csvUpload.status !== 'awaiting_timestamp') {
            return res.status(400).json({ error: 'Upload is not awaiting timestamp input' });
        }

        // Retrieve normalized VMs from the upload record
        const normalizedVMs = csvUpload.normalizedData;
        if (!normalizedVMs || normalizedVMs.length === 0) {
            return res.status(400).json({ error: 'No normalized data found' });
        }

        logger.info(`[Provide Timestamp] User ${userId} provided time range: ${dataDays} days for ${normalizedVMs.length} VMs`);

        // Update all VMs with missing_timestamp=true
        const updatedVMs = normalizedVMs.map(vm => {
            if (vm.missing_timestamp === true) {
                return {
                    ...vm,
                    data_days: dataDays,
                    date_source: 'user_provided',
                    timestamp_status: 'user_provided',
                    confidence_cap: 0.70,
                    missing_timestamp: false // Mark as resolved
                };
            }
            return vm;
        });

        logger.info(`[Provide Timestamp] Updated ${updatedVMs.length} VMs with data_days=${dataDays}`);

        // STEP 2: Enrich VMs (only those that normalized successfully)
        const vmsToEnrich = updatedVMs.filter(vm => !vm.status || vm.status !== 'normalization_error');
        const enrichedVMs = await enrichVMBatch(vmsToEnrich);

        logger.info(`Enriched ${enrichedVMs.length} VMs`);

        // STEP 3: Call ML service for predictions
        let mlResults = [];

        try {
            mlResults = await processVMsInBatches(enrichedVMs, 100);
            logger.info(`Received ${mlResults.length} predictions from ML service`);
        } catch (mlError) {
            logger.error('ML Service Error', { error: mlError.message });
            return res.status(503).json({
                error: 'ML Service Required',
                message: 'The ML service is not available or failed to process the request.',
                details: mlError.message,
            });
        }

        // STEP 3.5: Add Gemini AI analysis
        const resultsWithAI = await Promise.all(mlResults.map(async (result) => {
            let aiAnalysis = null;

            try {
                // Skip Gemini for error statuses
                if (result.status === 'unresolvable' || result.status === 'normalization_error') {
                    return { ...result, ai_analysis: null };
                }

                // Determine which Gemini function to call based on VM status
                if (result.prediction === 'Optimal') {
                    const message = await geminiService.getOptimalInsight(result);
                    aiAnalysis = {
                        type: 'insight',
                        message: message,
                        verdict: 'VALID',
                        risk_level: 'LOW',
                        warnings: []
                    };
                } else if (result.status === 'insufficient_data' || result.confidence < 0.50) {
                    const message = await geminiService.getAdvisoryMessage(result);
                    aiAnalysis = {
                        type: 'advisory',
                        message: message,
                        verdict: null,
                        risk_level: null,
                        warnings: []
                    };
                } else if (result.recommendation) {
                    // Valid recommendation - get explanation and validation
                    const explanation = await geminiService.generateExplanation(result, result.recommendation);
                    const validation = await geminiService.validateRecommendation(result, result.recommendation);

                    aiAnalysis = {
                        type: 'full',
                        explanation: explanation,
                        verdict: validation.verdict,
                        risk_level: validation.risk_level,
                        warnings: validation.warnings || [],
                        message: explanation
                    };
                }
            } catch (error) {
                logger.error('[Gemini] Failed to generate AI analysis', {
                    instance_id: result.instance_id,
                    error: error.message
                });
                // Continue without AI analysis - don't block the pipeline
            }

            return {
                ...result,
                ai_analysis: aiAnalysis
            };
        }));

        // STEP 4: Combine results (ML results with AI + error records)
        const errorRecords = updatedVMs.filter(vm => vm.status === 'normalization_error');
        const allResults = [...resultsWithAI, ...errorRecords];

        // STEP 5: Transform to frontend format
        const frontendResults = allResults.map((result, i) => {
            // Handle error records
            if (result.status === 'normalization_error' || result.status === 'ml_service_error') {
                return {
                    id: result.instance_id || `error-${i}`,
                    name: result.instance_id || `Error ${i + 1}`,
                    cloud: result.cloud || 'unknown',
                    region: result.region || 'unknown',
                    resourceType: 'vm',
                    finding: 'Error',
                    instanceType: result.instance_type || 'unknown',
                    recommendedType: null,
                    confidence: 0,
                    cpuUsage: 0,
                    memUsage: 0,
                    savings: null,
                    costPerMonth: 0,
                    optimizedCostPerMonth: 0,
                    recommendation: result.error || 'Processing error',
                    status: result.status,
                    aiAnalysis: null
                };
            }

            // Handle successful ML results
            const finding = result.prediction || 'Optimal';
            const instanceType = result.instance_type || 'unknown';
            const recType = result.recommendedType || result.recommendation?.suggested_instance || instanceType;
            const savings = result.savings || result.recommendation?.monthly_savings || 0;
            const costMonth = result.currentCostPerMonth || result.current_cost_per_month || 0;
            const optimizedCostMonth = result.optimizedCostPerMonth || (result.recommendation?.suggested_instance ?
                (costMonth - savings) : costMonth);

            let recommendation = result.ml_recommendation_text;
            if (!recommendation) {
                if (finding === 'Optimal') {
                    recommendation = 'Resource is optimally provisioned — no action required.';
                } else if (finding === 'Oversized') {
                    if (!recType || recType === instanceType) {
                        recommendation = 'No smaller instance available in this region';
                    } else {
                        recommendation = `Oversized — downsize from ${instanceType} to ${recType} and save ${savings.toFixed(2)}/mo.`;
                    }
                } else if (finding === 'Undersized') {
                    if (!recType || recType === instanceType) {
                        recommendation = 'No larger instance available in this region';
                    } else {
                        recommendation = `Undersized — upgrade from ${instanceType} to ${recType} for better performance.`;
                    }
                }
            }

            return {
                id: result.instance_id || `resource-${i + 1}`,
                name: result.instance_id || `Resource ${i + 1}`,
                cloud: result.cloud || 'aws',
                region: result.region || 'us-east-1',
                resourceType: 'vm',
                finding,
                instanceType,
                recommendedType: recType,
                confidence: result.confidence || 0,
                confidenceFlag: result.confidence_flag,
                cpuUsage: Math.round(result.metrics?.cpu_avg || 0),
                memUsage: Math.round(result.metrics?.memory_avg || 0),
                savings,
                costPerMonth: costMonth,
                optimizedCostPerMonth: optimizedCostMonth,
                recommendation,
                priceSource: result.price_source || 'estimated',
                status: result.status,
                aiAnalysis: result.ai_analysis || null,
                dataQuality: result.data_quality,
                granularity: result.granularity,
                anomalyFlag: result.anomaly_flag,
                modelVersion: result.model_version,
                recommendedAction: result.recommended_action,
                performanceRisk: result.performance_risk,
                costImpact: result.cost_impact
            };
        });

        // Mark upload as processed
        csvUpload.status = 'processed';
        csvUpload.processedRecords = frontendResults.length;
        csvUpload.normalizedData = undefined; // Clear temporary data
        await csvUpload.save();

        logger.info(`[Provide Timestamp] Returning ${frontendResults.length} recommendations to frontend`);

        return res.json({
            success: true,
            count: frontendResults.length,
            results: frontendResults
        });

    } catch (error) {
        logger.error('[Provide Timestamp] Error', { error: error.message, stack: error.stack });

        return res.status(500).json({
            error: error.message || 'Failed to process timestamp input',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

module.exports = { uploadCsv, cleanup, saveReport, provideTimestamp };
