const mongoose = require('mongoose');

const cloudConfigSchema = new mongoose.Schema({
    userId: { type: String, required: true }, // Link to user who owns these creds
    provider: {
        type: String,
        required: true,
        enum: ['AWS', 'Azure', 'GCP']
    },
    credentials: {
        // AWS
        accessKeyId: String,
        secretAccessKey: String,
        region: String,

        // Azure
        tenantId: String,
        clientId: String,
        clientSecret: String,
        subscriptionId: String,

        // GCP
        serviceAccountJson: String, // We'll store the whole JSON string
    },
    status: {
        type: String,
        enum: ['CONNECTED', 'FAILED', 'PENDING', 'INVALID'],
        default: 'PENDING'
    },
    lastChecked: { type: Date, default: Date.now },
    lastError: { type: String }, // Store last error message
    warnings: [{
        api: String,
        error: String,
        impact: String,
        required: Boolean
    }],
    limitedAccess: { type: Boolean, default: false },
    // NEW: Enhanced connection status fields
    connection_status: {
        type: String,
        enum: ['full', 'partial', 'failed'],
        default: 'full'
    },
    missing_permissions: [{ type: String }],
    impact: [{ type: String }]
}, {
    timestamps: true
});

// Basic encryption (placeholder) - in real app use a library like crypto-js or mongoose schemas with getters/setters for encryption
// For this task, we store as plain text as per plan request for speed/simplicity, 
// acknowledging security risk.

module.exports = mongoose.model('CloudConfig', cloudConfigSchema);
