const express = require('express');
const router = express.Router();
const optimizationController = require('../controllers/optimizationController');
const csvController = require('../controllers/csvController');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

// All routes require authentication
router.use(authMiddleware);

// POST /api/optimize/run — trigger full ML inference pipeline
router.post('/run', optimizationController.runPipeline);

// POST /api/optimize/csv — upload CSV for ML analysis
router.post('/csv', upload.single('file'), csvController.uploadCsv);

// GET /api/optimize/predictions — all predictions (optional ?cloud=aws&prediction=OVERSIZED)
router.get('/predictions', optimizationController.getPredictions);

// GET /api/optimize/recommendations — full recommendations (optional ?instance_id=...)
router.get('/recommendations', optimizationController.getRecommendations);

module.exports = router;
