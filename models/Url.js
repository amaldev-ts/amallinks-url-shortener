const mongoose = require('mongoose');

const UrlSchema = new mongoose.Schema({
    originalUrl: {
        type: String,
        required: true,
        trim: true
    },
    shortId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    clickCount: {
        type: Number,
        default: 0
    },
    clickDetails: [{
        timestamp: { type: Date, default: Date.now },
        referrer: { type: String, default: 'Direct' },
        userAgent: { type: String, default: 'Unknown' },
        ip: { type: String, default: 'Unknown' }
    }],
    expiresAt: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: String,
        default: 'anonymous'
    }
}, {
    timestamps: true
});

// Index for auto-deletion of expired URLs
UrlSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Url', UrlSchema);