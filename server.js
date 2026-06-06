require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/db');
const Url = require('./models/Url');

const app = express();

// Connect Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});

const shortenLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: { error: 'Too many URLs created. Please try again later.' }
});

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/url', apiLimiter, require('./routes/url'));
app.use('/api/url/shorten', shortenLimiter);
app.use('/api/qr', apiLimiter, require('./routes/qr'));
app.use('/api/admin', apiLimiter, require('./routes/admin'));

// Serve admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// @route   GET /:shortId
// @desc    Redirect to original URL
app.get('/:shortId', async (req, res) => {
    try {
        const url = await Url.findOne({ shortId: req.params.shortId });

        if (!url) {
            return res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
        }

        // Check if expired
        if (url.expiresAt && url.expiresAt < new Date()) {
            url.isActive = false;
            await url.save();
            return res.status(410).json({ error: 'This link has expired' });
        }

        // Check if active
        if (!url.isActive) {
            return res.status(410).json({ error: 'This link has been deactivated' });
        }

        // Update click count and details
        url.clickCount++;
        url.clickDetails.push({
            timestamp: new Date(),
            referrer: req.get('Referrer') || 'Direct',
            userAgent: req.get('User-Agent') || 'Unknown',
            ip: req.ip || req.connection.remoteAddress || 'Unknown'
        });

        await url.save();

        return res.redirect(301, url.originalUrl);

    } catch (error) {
        console.error('Redirect Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`
    🚀 URL Shortener Server Running!
    📡 Port: ${PORT}
    🌐 URL: http://localhost:${PORT}
    👤 Admin: http://localhost:${PORT}/admin
    `);
});