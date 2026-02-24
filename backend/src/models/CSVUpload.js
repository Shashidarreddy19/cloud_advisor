const mongoose = require('mongoose');

const CSVUploadSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    path: { type: String, required: true },
    size: { type: Number, required: true },
    uploadDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
    processedRecords: { type: Number, default: 0 }
});

module.exports = mongoose.model('CSVUpload', CSVUploadSchema);
