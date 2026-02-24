const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resourceController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/:resourceId/metrics', authMiddleware, resourceController.getResourceMetrics);

module.exports = router;
