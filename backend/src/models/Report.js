const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['CSV', 'Cloud', 'Combined'],
        default: 'CSV'
    },
    status: {
        type: String,
        enum: ['Generated', 'Archived', 'Deleted'],
        default: 'Generated'
    },
    recommendations: [{
        id: String,
        name: String,
        cloud: String,
        resourceType: String,
        finding: String,
        instanceType: String,
        recommendedType: String,
        confidence: Number,
        cpuUsage: Number,
        memUsage: Number,
        savings: Number,
        recommendation: String,
        region: String
    }],
    summary: {
        totalRecommendations: { type: Number, default: 0 },
        totalSavings: { type: Number, default: 0 },
        oversizedCount: { type: Number, default: 0 },
        undersizedCount: { type: Number, default: 0 },
        optimalCount: { type: Number, default: 0 },
        avgConfidence: { type: Number, default: 0 }
    },
    generatedAt: {
        type: Date,
        default: Date.now
    },
    size: String // e.g., "45 KB"
});

module.exports = mongoose.model('Report', ReportSchema);
