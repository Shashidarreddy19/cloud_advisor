const mongoose = require('mongoose');

const CSVUploadSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    path: { type: String, required: true },
    size: { type: Number, required: true },
    uploadDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'processed', 'failed', 'awaiting_timestamp'], default: 'pending' },
    processedRecords: { type: Number, default: 0 },

    // Temporary storage for normalized data (used when awaiting timestamp input)
    normalizedData: { type: mongoose.Schema.Types.Mixed, default: undefined },

    // Lifecycle management fields
    mode: { type: String, enum: ['csv', 'cloud'], default: 'csv' },
    lastAccessed: { type: Date, default: Date.now },
    markedForDeletion: { type: Boolean, default: false }
});

// Indexes for efficient cleanup queries
CSVUploadSchema.index({ uploadDate: 1, status: 1 });
CSVUploadSchema.index({ userId: 1, mode: 1 });

module.exports = mongoose.model('CSVUpload', CSVUploadSchema);
