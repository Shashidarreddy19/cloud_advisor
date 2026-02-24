const User = require('../models/User');
const CloudConfig = require('../models/CloudConnection');
const Resource = require('../models/Resource');
const Report = require('../models/Report');
const CSVUpload = require('../models/CSVUpload');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// Get user settings
const getSettings = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            profile: {
                username: user.username,
                email: user.email || '',
                organization: user.organization || '',
                role: user.role || 'Cloud Engineer',
            },
            notifications: user.notificationSettings || {
                emailNotifications: true,
                weeklyReports: true,
                savingsAlerts: true,
                securityAlerts: true,
            },
            preferences: user.preferences || {
                currency: 'USD',
                dateFormat: 'MM/DD/YYYY',
                theme: 'light',
                language: 'en',
            },
        });
    } catch (error) {
        logger.error('Get Settings Error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};

// Update profile
const updateProfile = async (req, res) => {
    try {
        const { username, email, organization, role } = req.body;

        // Check if username is already taken by another user
        if (username && username !== req.user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ error: 'Username already taken' });
            }
        }

        // Check if email is already taken by another user
        if (email) {
            const existingEmail = await User.findOne({ email, _id: { $ne: req.user._id } });
            if (existingEmail) {
                return res.status(400).json({ error: 'Email already in use' });
            }
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                username,
                email,
                organization,
                role,
            },
            { new: true }
        ).select('-password');

        res.json({ success: true, user });
    } catch (error) {
        logger.error('Update Profile Error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

// Change password
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const user = await User.findById(req.user._id);

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        user.password = hashedPassword;
        await user.save();

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        logger.error('Change Password Error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};

// Update notifications
const updateNotifications = async (req, res) => {
    try {
        const notificationSettings = req.body;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { notificationSettings },
            { new: true }
        ).select('-password');

        res.json({ success: true, notificationSettings: user.notificationSettings });
    } catch (error) {
        logger.error('Update Notifications Error:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
};

// Update preferences
const updatePreferences = async (req, res) => {
    try {
        const preferences = req.body;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { preferences },
            { new: true }
        ).select('-password');

        res.json({ success: true, preferences: user.preferences });
    } catch (error) {
        logger.error('Update Preferences Error:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
};

// Export user data
const exportData = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        const cloudConfigs = await CloudConfig.find({ userId: req.user._id }).select('-credentials');
        const resources = await Resource.find({ userId: req.user._id });
        const reports = await Report.find({ userId: req.user._id });
        const csvUploads = await CSVUpload.find({ userId: req.user._id });

        const exportData = {
            user: {
                username: user.username,
                email: user.email,
                organization: user.organization,
                role: user.role,
                createdAt: user.createdAt,
            },
            cloudConnections: cloudConfigs.map(c => ({
                provider: c.provider,
                status: c.status,
                connectedAt: c.createdAt,
            })),
            resources: resources.map(r => ({
                provider: r.provider,
                name: r.name,
                resourceType: r.resourceType,
                region: r.region,
                optimizationStatus: r.optimizationStatus,
                estimatedSavings: r.estimatedSavings,
            })),
            reports: reports.map(r => ({
                name: r.name,
                type: r.type,
                createdAt: r.createdAt,
            })),
            csvUploads: csvUploads.map(c => ({
                filename: c.filename,
                uploadedAt: c.createdAt,
            })),
            exportedAt: new Date().toISOString(),
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="cloud-optimizer-data-${Date.now()}.json"`);
        res.json(exportData);
    } catch (error) {
        logger.error('Export Data Error:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
};

// Delete account
const deleteAccount = async (req, res) => {
    try {
        const userId = req.user._id;

        // Delete all user data
        await Promise.all([
            User.findByIdAndDelete(userId),
            CloudConfig.deleteMany({ userId }),
            Resource.deleteMany({ userId }),
            Report.deleteMany({ userId }),
            CSVUpload.deleteMany({ userId }),
        ]);

        logger.info(`User account deleted: ${userId}`);
        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        logger.error('Delete Account Error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
};

module.exports = {
    getSettings,
    updateProfile,
    changePassword,
    updateNotifications,
    updatePreferences,
    exportData,
    deleteAccount,
};
