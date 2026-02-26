const express = require('express');
const router = express.Router();
const multer = require('multer');
const csvController = require('../controllers/csvController');
const authMiddleware = require('../middleware/authMiddleware');

const upload = multer({ dest: 'uploads/' });

router.post('/upload', authMiddleware, upload.single('file'), csvController.uploadCsv);
router.post('/cleanup', authMiddleware, csvController.cleanup);
router.post('/save-report', authMiddleware, csvController.saveReport);

module.exports = router;
