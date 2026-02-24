const express = require('express');
const router = express.Router();
const multer = require('multer');
const csvController = require('../controllers/csvController');
const authMiddleware = require('../middleware/authMiddleware');

const upload = multer({ dest: 'uploads/' });

router.post('/upload', authMiddleware, upload.single('file'), csvController.uploadCsv);
// Mapping old route for compatibility if needed, or just new one.
// The frontend calls /api/optimize/csv, so we might need to map it in server.js or here.
// User checking structure: src/routes/csvRoutes.js
// I'll keep it clean here.

module.exports = router;
