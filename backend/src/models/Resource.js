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

    // Captured Metrics - ALLOW NULL for missing data
    avgCpuUtilization: { type: Number, default: null },
    maxCpuUtilization: { type: Number, default: null },
    avgMemoryUtilization: { type: Number, default: null },
    maxMemoryUtilization: { type: Number, default: null },
    networkIn: Number,
    networkOut: Number,
    diskReadBytes: Number,
    diskWriteBytes: Number,

    // NEW: CPU + Memory Recommendation System Metrics
    cpu_avg: { type: Number, default: null },
    cpu_p95: { type: Number, default: null },
    memory_avg: { type: Number, default: null },
    memory_p95: { type: Number, default: null },

    // Metrics status indicator
    metrics_status: {
        type: String,
        enum: ['complete', 'partial', 'missing', 'insufficient_data', 'instance_stopped'],
        default: 'missing'
    },

    // NEW: Metrics metadata
    running_hours_last_14d: { type: Number, default: 0 },
    metrics_window_days: { type: Number, default: null },
    state_checked_at: { type: Date, default: null },

    // Logic/Status
    optimizationStatus: {
        type: String,
        enum: ['UNDERUTILIZED', 'OVERUTILIZED', 'OPTIMAL', 'INSUFFICIENT_DATA', 'undersized', 'oversized', 'optimal', 'insufficient_data', 'UNDERSIZED', 'OVERSIZED', 'Unknown'],
        default: 'OPTIMAL'
    },
    recommendation: {
        type: String,
        enum: ['OVERSIZED', 'UNDERSIZED', 'OPTIMAL', null],
        default: null
    },
    confidence: { type: Number, default: null },
    recommendation_warnings: [{ type: String }],

    // Financials
    estimatedMonthlyCost: Number,
    estimatedSavings: Number,

    // NEW: Memory metrics source tracking
    memory_metrics_source: {
        type: String,
        enum: ['available', 'agent_required', 'unavailable'],
        default: 'unavailable'
    },
    missing_metrics: [{ type: String }],

    // NEW: Pricing transparency fields
    price_source: {
        type: String,
        enum: ['live', 'cached', 'db', 'estimated', 'unavailable'],
        default: 'cached'
    },
    fallback_reason: String,
    price_last_updated: { type: Date, default: Date.now },

    // NEW: ML prediction confidence (0-1 or 0-100)
    prediction_confidence: { type: Number, default: 0 },
    confidence_flag: {
        type: String,
        enum: ['insufficient', 'low', null],
        default: null
    },

    // NEW: Recommended instance details
    recommendedType: String, // e.g., 't3.medium'
    recommendedVcpu: Number,
    recommendedMemory: Number, // in GB

    // NEW: Architecture & compatibility
    architecture: { type: String, default: 'x86_64' }, // x86_64, arm64
    instance_family: String, // e.g., 't3', 'Standard_D'
    available_in_region: { type: Boolean, default: true },

    // NEW: Recommendation reason
    reason: String, // Explanation for the recommendation

    // NEW: OS Detection fields
    os_type: {
        type: String,
        enum: ['Linux', 'Windows', 'unknown'],
        default: 'unknown'
    },
    os_source: {
        type: String,
        enum: ['cloud', 'inferred', 'unresolved'],
        default: 'unresolved'
    },
    os_confidence: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'low'
    },

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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual field for backward compatibility - map 'state' to 'status'
cloudResourceSchema.virtual('status').get(function () {
    return this.state || 'unknown';
});

module.exports = mongoose.model('CloudResource', cloudResourceSchema);
