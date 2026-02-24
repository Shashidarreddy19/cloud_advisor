const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    organization: { type: String },
    role: {
        type: String,
        enum: ['Cloud Engineer', 'DevOps Engineer', 'System Administrator', 'Developer', 'Manager', 'Student', 'Other'],
        default: 'Cloud Engineer'
    },
    cloudProvider: {
        type: String,
        enum: ['AWS', 'Azure', 'GCP', 'Multi-cloud']
    },
    termsAccepted: { type: Boolean, required: true },
    notificationSettings: {
        emailNotifications: { type: Boolean, default: true },
        weeklyReports: { type: Boolean, default: true },
        savingsAlerts: { type: Boolean, default: true },
        securityAlerts: { type: Boolean, default: true },
    },
    preferences: {
        currency: { type: String, default: 'USD' },
        dateFormat: { type: String, default: 'MM/DD/YYYY' },
        theme: { type: String, default: 'light' },
        language: { type: String, default: 'en' },
    },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
