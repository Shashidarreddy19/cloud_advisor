const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Get all reports for the authenticated user
router.get('/', reportController.getReports);

// Generate/Save a new report
router.post('/generate', reportController.generateReport);

// Get a specific report by ID
router.get('/:id', reportController.getReportById);

// Delete a report
router.delete('/:id', reportController.deleteReport);

// Download report as CSV
router.get('/:id/download', reportController.downloadReport);

module.exports = router;
