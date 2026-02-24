const fileService = require('../services/fileService');
const { normalizeVM, autoDetectColumns, validateRequiredColumns, NormalizationError } = require('../services/normalizationService');
const { enrichVMBatch } = require('../services/enrichmentService');
const { processVMsInBatches } = require('../services/mlService');
const CSVUpload = require('../models/CSVUpload');
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
        const enrichedVMs = enrichVMBatch(vmsToEnrich);

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

        // STEP 4: Combine results (ML results + error records)
        const errorRecords = normalizedVMs.filter(vm => vm.status === 'normalization_error');
        const allResults = [...mlResults, ...errorRecords];

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
                    status: result.status
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
                status: result.status
            };
        });

        // Mark upload as processed
        csvUpload.status = 'processed';
        csvUpload.processedRecords = frontendResults.length;
        await csvUpload.save();

        logger.info(`Returning ${frontendResults.length} recommendations to frontend`);

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

module.exports = { uploadCsv };
