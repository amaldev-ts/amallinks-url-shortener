const express = require('express');
const router = express.Router();
const validUrl = require('valid-url');
const shortid = require('shortid');
const Url = require('../models/Url');

// @route   POST /api/url/shorten
// @desc    Create short URL
router.post('/shorten', async (req, res) => {
    try {
        let { originalUrl, customAlias, expiresIn } = req.body;

        // Validate original URL
        if (!originalUrl) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Add protocol if missing
        if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://')) {
            originalUrl = 'https://' + originalUrl;
        }

        if (!validUrl.isUri(originalUrl)) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        // Handle custom alias
        let shortId;
        if (customAlias) {
            // Validate custom alias
            const aliasRegex = /^[a-zA-Z0-9_-]{3,30}$/;
            if (!aliasRegex.test(customAlias)) {
                return res.status(400).json({
                    error: 'Alias must be 3-30 characters (letters, numbers, hyphens, underscores)'
                });
            }

            // Check if alias already exists
            const existingUrl = await Url.findOne({ shortId: customAlias });
            if (existingUrl) {
                return res.status(409).json({ error: 'This alias is already taken. Try another one.' });
            }
            shortId = customAlias;
        } else {
            shortId = shortid.generate();
        }

        // Handle expiry date
        let expiresAt = null;
        if (expiresIn) {
            const now = new Date();
            switch (expiresIn) {
                case '1h': expiresAt = new Date(now.getTime() + 60 * 60 * 1000); break;
                case '24h': expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); break;
                case '7d': expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); break;
                case '30d': expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); break;
                case 'never': expiresAt = null; break;
                default:
                    // Custom date
                    const customDate = new Date(expiresIn);
                    if (customDate > now) {
                        expiresAt = customDate;
                    }
            }
        }

        // Check if same URL already shortened (without custom alias)
        if (!customAlias) {
            const existing = await Url.findOne({ originalUrl, isActive: true });
            if (existing) {
                return res.json({
                    shortUrl: `${process.env.BASE_URL}/${existing.shortId}`,
                    shortId: existing.shortId,
                    originalUrl: existing.originalUrl,
                    clickCount: existing.clickCount,
                    expiresAt: existing.expiresAt,
                    createdAt: existing.createdAt,
                    isExisting: true
                });
            }
        }

        // Create new URL
        const url = new Url({
            originalUrl,
            shortId,
            expiresAt,
            createdBy: req.ip || 'anonymous'
        });

        await url.save();

        res.status(201).json({
            shortUrl: `${process.env.BASE_URL}/${shortId}`,
            shortId,
            originalUrl,
            clickCount: 0,
            expiresAt,
            createdAt: url.createdAt,
            isExisting: false
        });

    } catch (error) {
        console.error('Shorten Error:', error);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// @route   GET /api/url/stats/:shortId
// @desc    Get URL statistics
router.get('/stats/:shortId', async (req, res) => {
    try {
        const url = await Url.findOne({ shortId: req.params.shortId });
        if (!url) {
            return res.status(404).json({ error: 'URL not found' });
        }
        res.json({
            originalUrl: url.originalUrl,
            shortId: url.shortId,
            shortUrl: `${process.env.BASE_URL}/${url.shortId}`,
            clickCount: url.clickCount,
            clickDetails: url.clickDetails.slice(-50), // Last 50 clicks
            expiresAt: url.expiresAt,
            isActive: url.isActive,
            createdAt: url.createdAt
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/url/check/:alias
// @desc    Check if alias is available
router.get('/check/:alias', async (req, res) => {
    try {
        const existing = await Url.findOne({ shortId: req.params.alias });
        res.json({ available: !existing });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;