const express = require('express');
const router = express.Router();
const cloudController = require('../controllers/cloudController');
const authMiddleware = require('../middleware/authMiddleware');

// Cloud configuration endpoints
router.post('/connect', authMiddleware, cloudController.saveConfig);
router.post('/config', authMiddleware, cloudController.saveConfig);
router.get('/config/:userId', authMiddleware, cloudController.getConfigByUserId);
router.get('/config', authMiddleware, cloudController.getConfig);
router.delete('/config', authMiddleware, cloudController.deleteConfig);
router.post('/disconnect', authMiddleware, cloudController.deleteConfig);

// Resource management endpoints
router.post('/sync', authMiddleware, cloudController.syncResources);
router.post('/analyze', authMiddleware, cloudController.analyzeResources);
router.post('/poll-states', authMiddleware, cloudController.pollInstanceStates); // NEW: On-demand state polling
router.get('/resources/:userId', authMiddleware, cloudController.getResourcesByUserId);
router.get('/resources', authMiddleware, cloudController.getResources);
router.get('/resource/:id', authMiddleware, cloudController.getResourceById); // Get single resource by MongoDB ID

// AWS specific endpoints
router.post('/aws/regions', cloudController.fetchAwsRegions); // No auth required for region lookup

module.exports = router;
