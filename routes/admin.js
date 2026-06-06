const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Url = require('../models/Url');
const { protect } = require('../middleware/auth');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @route   POST /api/admin/register
// @desc    Register admin
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, setupKey } = req.body;

        // Verify setup key
        if (setupKey !== process.env.ADMIN_SETUP_KEY) {
            return res.status(403).json({ error: 'Invalid setup key' });
        }

        // Check existing
        const existingAdmin = await Admin.findOne({ $or: [{ email }, { username }] });
        if (existingAdmin) {
            return res.status(409).json({ error: 'Admin already exists' });
        }

        const admin = await Admin.create({ username, email, password });

        res.status(201).json({
            id: admin._id,
            username: admin.username,
            email: admin.email,
            token: generateToken(admin._id)
        });

    } catch (error) {
        console.error('Register Error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// @route   POST /api/admin/login
// @desc    Login admin
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await Admin.findOne({ email });
        if (!admin || !(await admin.matchPassword(password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        res.json({
            id: admin._id,
            username: admin.username,
            email: admin.email,
            token: generateToken(admin._id)
        });

    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// @route   GET /api/admin/dashboard
// @desc    Get dashboard stats
router.get('/dashboard', protect, async (req, res) => {
    try {
        const totalUrls = await Url.countDocuments();
        const activeUrls = await Url.countDocuments({ isActive: true });
        const totalClicks = await Url.aggregate([
            { $group: { _id: null, total: { $sum: '$clickCount' } } }
        ]);

        // Today's stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayUrls = await Url.countDocuments({ createdAt: { $gte: today } });

        // Top URLs
        const topUrls = await Url.find({ isActive: true })
            .sort({ clickCount: -1 })
            .limit(10)
            .select('originalUrl shortId clickCount createdAt expiresAt isActive');

        // Recent URLs
        const recentUrls = await Url.find()
            .sort({ createdAt: -1 })
            .limit(20)
            .select('originalUrl shortId clickCount createdAt expiresAt isActive');

        // Clicks per day (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const clicksPerDay = await Url.aggregate([
            { $unwind: '$clickDetails' },
            { $match: { 'clickDetails.timestamp': { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$clickDetails.timestamp' }
                    },
                    clicks: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Expired URLs count
        const expiredUrls = await Url.countDocuments({
            expiresAt: { $ne: null, $lt: new Date() }
        });

        res.json({
            totalUrls,
            activeUrls,
            expiredUrls,
            totalClicks: totalClicks[0]?.total || 0,
            todayUrls,
            topUrls,
            recentUrls,
            clicksPerDay
        });

    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
});

// @route   GET /api/admin/urls
// @desc    Get all URLs with pagination
router.get('/urls', protect, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const status = req.query.status || 'all';

        let query = {};

        if (search) {
            query.$or = [
                { originalUrl: { $regex: search, $options: 'i' } },
                { shortId: { $regex: search, $options: 'i' } }
            ];
        }

        if (status === 'active') query.isActive = true;
        if (status === 'inactive') query.isActive = false;
        if (status === 'expired') {
            query.expiresAt = { $ne: null, $lt: new Date() };
        }

        const total = await Url.countDocuments(query);
        const urls = await Url.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            urls,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch URLs' });
    }
});

// @route   DELETE /api/admin/urls/:id
// @desc    Delete a URL
router.delete('/urls/:id', protect, async (req, res) => {
    try {
        const url = await Url.findByIdAndDelete(req.params.id);
        if (!url) {
            return res.status(404).json({ error: 'URL not found' });
        }
        res.json({ message: 'URL deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete URL' });
    }
});

// @route   PATCH /api/admin/urls/:id/toggle
// @desc    Toggle URL active status
router.patch('/urls/:id/toggle', protect, async (req, res) => {
    try {
        const url = await Url.findById(req.params.id);
        if (!url) {
            return res.status(404).json({ error: 'URL not found' });
        }
        url.isActive = !url.isActive;
        await url.save();
        res.json({ message: 'URL status updated', isActive: url.isActive });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update URL' });
    }
});

module.exports = router;