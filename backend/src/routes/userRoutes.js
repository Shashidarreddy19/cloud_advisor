const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Get user settings
router.get('/settings', userController.getSettings);

// Update profile
router.put('/profile', userController.updateProfile);

// Change password
router.put('/password', userController.changePassword);

// Update notifications
router.put('/notifications', userController.updateNotifications);

// Update preferences
router.put('/preferences', userController.updatePreferences);

// Export user data
router.get('/export', userController.exportData);

// Delete account
router.delete('/account', userController.deleteAccount);

module.exports = router;
