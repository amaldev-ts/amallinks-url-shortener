const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

// @route   POST /api/qr/generate
// @desc    Generate QR code
router.post('/generate', async (req, res) => {
    try {
        const { url, size = 300 } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const qrOptions = {
            width: Math.min(size, 1000),
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            errorCorrectionLevel: 'H'
        };

        const qrDataUrl = await QRCode.toDataURL(url, qrOptions);

        res.json({
            qrCode: qrDataUrl,
            url: url
        });

    } catch (error) {
        console.error('QR Error:', error);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

module.exports = router;