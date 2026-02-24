const mongoose = require('mongoose');

const cloudResourceSchema = new mongoose.Schema({
    userId: { type: String, required: true }, // Link to user
    resourceId: { type: String, required: true }, // e.g., i-1234567890abcdef0
    name: String,
    provider: String, // AWS, AZURE, GCP
    service: String, // EC2, RDS, VM, COMPUTE_ENGINE
    region: String,
    resourceType: String, // t3.medium, Standard_D2s_v3
    state: String, // running, stopped, stopping, terminated, etc.

    // Resource Specs
    vCpu: Number,
    memoryGb: Number,
    diskGb: Number,

    // Captured Metrics
    avgCpuUtilization: Number,
    maxCpuUtilization: Number,
    avgMemoryUtilization: Number,
    maxMemoryUtilization: Number,
    networkIn: Number,
    networkOut: Number,
    diskReadBytes: Number,
    diskWriteBytes: Number,

    // Logic/Status
    optimizationStatus: {
        type: String,
        enum: ['UNDERUTILIZED', 'OVERUTILIZED', 'OPTIMAL', 'INSUFFICIENT_DATA', 'undersized', 'oversized', 'optimal', 'insufficient_data'],
        default: 'OPTIMAL'
    },
    recommendation: String, // "Upsize to...", "Downsize to..."

    // Financials
    estimatedMonthlyCost: Number,
    estimatedSavings: Number,

    lastFetched: { type: Date, default: Date.now },
    created: { type: Date, default: Date.now },

    // Raw/Extra tags
    tags: { type: Map, of: String },

    // Historical Time-Series (Cached from CloudWatch/Azure Monitor)
    metricsHistory: {
        cpu: [{ timestamp: Date, value: Number }],
        memory: [{ timestamp: Date, value: Number }],
        disk: [{ timestamp: Date, value: Number }], // IOPS
        networkIn: [{ timestamp: Date, value: Number }],
        networkOut: [{ timestamp: Date, value: Number }],
        // DB Specifics
        dbConnections: [{ timestamp: Date, value: Number }],
        dbLatency: [{ timestamp: Date, value: Number }], // ms
        dbMemoryPressure: [{ timestamp: Date, value: Number }],
        dbIopsRead: [{ timestamp: Date, value: Number }],
        dbIopsWrite: [{ timestamp: Date, value: Number }],
        dbStorageUsed: [{ timestamp: Date, value: Number }],
        dbStorageFree: [{ timestamp: Date, value: Number }]
    },

    // UI State
    dismissed: { type: Boolean, default: false }
}, {
    collection: 'cloud_resources',
    timestamps: true
});

module.exports = mongoose.model('CloudResource', cloudResourceSchema);
