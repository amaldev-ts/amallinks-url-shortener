// ==========================================
// URL SHORTENER - MAIN APPLICATION
// ==========================================

class URLShortener {
    constructor() {
        this.currentShortUrl = '';
        this.currentShortId = '';
        this.debounceTimer = null;

        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.loadTheme();
    }

    bindElements() {
        // Form elements
        this.urlForm = document.getElementById('urlForm');
        this.urlInput = document.getElementById('urlInput');
        this.aliasInput = document.getElementById('aliasInput');
        this.expirySelect = document.getElementById('expirySelect');
        this.shortenBtn = document.getElementById('shortenBtn');
        this.urlValidation = document.getElementById('urlValidation');
        this.aliasStatus = document.getElementById('aliasStatus');

        // Advanced options
        this.advancedToggle = document.getElementById('advancedToggle');
        this.advancedOptions = document.getElementById('advancedOptions');

        // Result elements
        this.resultSection = document.getElementById('resultSection');
        this.shortUrlLink = document.getElementById('shortUrlLink');
        this.originalUrlText = document.getElementById('originalUrlText');
        this.clickCountMeta = document.getElementById('clickCountMeta');
        this.expiryMeta = document.getElementById('expiryMeta');
        this.expiryText = document.getElementById('expiryText');
        this.createdText = document.getElementById('createdText');

        // Buttons
        this.copyBtn = document.getElementById('copyBtn');
        this.qrBtn = document.getElementById('qrBtn');
        this.statsBtn = document.getElementById('statsBtn');

        // Stats
        this.statsSection = document.getElementById('statsSection');

        // Theme
        this.themeToggle = document.getElementById('themeToggle');

        // QR Modal
        this.qrModal = document.getElementById('qrModal');
        this.qrModalClose = document.getElementById('qrModalClose');
        this.qrCodeImg = document.getElementById('qrCodeImg');
        this.qrUrlText = document.getElementById('qrUrlText');
        this.qrDownloadBtn = document.getElementById('qrDownloadBtn');

        // Toast
        this.toastContainer = document.getElementById('toastContainer');
    }

    bindEvents() {
        // Form submit
        this.urlForm.addEventListener('submit', (e) => this.handleSubmit(e));

        // URL validation on input
        this.urlInput.addEventListener('input', () => this.validateUrl());

        // Alias availability check
        this.aliasInput.addEventListener('input', () => this.checkAlias());

        // Advanced toggle
        this.advancedToggle.addEventListener('click', () => this.toggleAdvanced());

        // Copy button
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());

        // QR button
        this.qrBtn.addEventListener('click', () => this.generateQR());

        // Stats button
        this.statsBtn.addEventListener('click', () => this.toggleStats());

        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());

        // QR Modal
        this.qrModalClose.addEventListener('click', () => this.closeQRModal());
        this.qrModal.addEventListener('click', (e) => {
            if (e.target === this.qrModal) this.closeQRModal();
        });

        // QR Download
        this.qrDownloadBtn.addEventListener('click', () => this.downloadQR());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeQRModal();
        });
    }

    // ==========================================
    // URL VALIDATION
    // ==========================================

    validateUrl() {
        const url = this.urlInput.value.trim();

        if (!url) {
            this.urlValidation.innerHTML = '';
            this.urlValidation.className = 'url-validation';
            return false;
        }

        const urlPattern = /^(https?:\/\/)?([\w-]+(\.[\w-]+)+)(\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?$/i;
        const isValid = urlPattern.test(url);

        if (isValid) {
            this.urlValidation.innerHTML = '<i class="fas fa-check-circle"></i> Valid URL';
            this.urlValidation.className = 'url-validation valid';
        } else {
            this.urlValidation.innerHTML = '<i class="fas fa-exclamation-circle"></i> Invalid URL format';
            this.urlValidation.className = 'url-validation invalid';
        }

        return isValid;
    }

    // ==========================================
    // ALIAS CHECK
    // ==========================================

    checkAlias() {
        const alias = this.aliasInput.value.trim();

        clearTimeout(this.debounceTimer);

        if (!alias) {
            this.aliasStatus.textContent = '';
            this.aliasStatus.className = 'alias-status';
            return;
        }

        const aliasRegex = /^[a-zA-Z0-9_-]{3,30}$/;
        if (!aliasRegex.test(alias)) {
            this.aliasStatus.textContent = '✗ Invalid format';
            this.aliasStatus.className = 'alias-status taken';
            return;
        }

        this.aliasStatus.textContent = '...';
        this.aliasStatus.className = 'alias-status';

        this.debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch(`/api/url/check/${alias}`);
                const data = await response.json();

                if (data.available) {
                    this.aliasStatus.textContent = '✓ Available';
                    this.aliasStatus.className = 'alias-status available';
                } else {
                    this.aliasStatus.textContent = '✗ Taken';
                    this.aliasStatus.className = 'alias-status taken';
                }
            } catch (error) {
                this.aliasStatus.textContent = '';
            }
        }, 500);
    }

    // ==========================================
    // FORM SUBMISSION
    // ==========================================

    async handleSubmit(e) {
        e.preventDefault();

        const originalUrl = this.urlInput.value.trim();
        const customAlias = this.aliasInput.value.trim();
        const expiresIn = this.expirySelect.value;

        if (!originalUrl) {
            this.showToast('Please enter a URL', 'error');
            this.urlInput.focus();
            return;
        }

        if (!this.validateUrl()) {
            this.showToast('Please enter a valid URL', 'error');
            return;
        }

        // Check alias validity
        if (customAlias) {
            const aliasRegex = /^[a-zA-Z0-9_-]{3,30}$/;
            if (!aliasRegex.test(customAlias)) {
                this.showToast('Alias must be 3-30 characters (letters, numbers, hyphens, underscores)', 'error');
                return;
            }
        }

        this.setLoading(true);

        try {
            const response = await fetch('/api/url/shorten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originalUrl, customAlias, expiresIn })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to shorten URL');
            }

            this.displayResult(data);
            this.showToast(data.isExisting ? 'URL already shortened!' : 'URL shortened successfully!', 'success');

        } catch (error) {
            this.showToast(error.message, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    // ==========================================
    // DISPLAY RESULT
    // ==========================================

    displayResult(data) {
        this.currentShortUrl = data.shortUrl;
        this.currentShortId = data.shortId;

        this.shortUrlLink.href = data.shortUrl;
        this.shortUrlLink.textContent = data.shortUrl;
        this.originalUrlText.textContent = data.originalUrl;
        this.clickCountMeta.textContent = `${data.clickCount} clicks`;
        this.createdText.textContent = this.formatDate(data.createdAt);

        if (data.expiresAt) {
            this.expiryMeta.style.display = 'flex';
            this.expiryText.textContent = `Expires: ${this.formatDate(data.expiresAt)}`;
        } else {
            this.expiryMeta.style.display = 'none';
        }

        // Reset stats section
        this.statsSection.classList.remove('show');

        // Show result
        this.resultSection.classList.add('show');

        // Scroll to result
        this.resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ==========================================
    // COPY TO CLIPBOARD
    // ==========================================

    async copyToClipboard() {
        try {
            await navigator.clipboard.writeText(this.currentShortUrl);

            this.copyBtn.classList.add('copied');
            this.copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';

            this.showToast('Copied to clipboard!', 'success');

            setTimeout(() => {
                this.copyBtn.classList.remove('copied');
                this.copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            }, 2000);

        } catch (error) {
            // Fallback
            const textArea = document.createElement('textarea');
            textArea.value = this.currentShortUrl;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('Copied to clipboard!', 'success');
        }
    }

    // ==========================================
    // QR CODE
    // ==========================================

    async generateQR() {
        try {
            const response = await fetch('/api/qr/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: this.currentShortUrl, size: 300 })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error);

            this.qrCodeImg.src = data.qrCode;
            this.qrUrlText.textContent = this.currentShortUrl;
            this.qrModal.classList.add('show');

        } catch (error) {
            this.showToast('Failed to generate QR code', 'error');
        }
    }

    downloadQR() {
        const link = document.createElement('a');
        link.download = `qr-${this.currentShortId}.png`;
        link.href = this.qrCodeImg.src;
        link.click();
        this.showToast('QR Code downloaded!', 'success');
    }

    closeQRModal() {
        this.qrModal.classList.remove('show');
    }

    // ==========================================
    // STATISTICS
    // ==========================================

    async toggleStats() {
        if (this.statsSection.classList.contains('show')) {
            this.statsSection.classList.remove('show');
            return;
        }

        try {
            const response = await fetch(`/api/url/stats/${this.currentShortId}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error);

            document.getElementById('statClicks').textContent = data.clickCount.toLocaleString();
            document.getElementById('statCreated').textContent = this.formatDateShort(data.createdAt);
            document.getElementById('statStatus').textContent = data.isActive ? 'Active' : 'Inactive';
            document.getElementById('statStatus').style.color = data.isActive ? 'var(--success)' : 'var(--danger)';

            // Update click count in meta
            this.clickCountMeta.textContent = `${data.clickCount} clicks`;

            this.statsSection.classList.add('show');

        } catch (error) {
            this.showToast('Failed to load statistics', 'error');
        }
    }

    // ==========================================
    // THEME
    // ==========================================

    toggleTheme() {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        const icon = this.themeToggle.querySelector('i');
        icon.className = newTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);

        const icon = this.themeToggle.querySelector('i');
        icon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }

    // ==========================================
    // ADVANCED OPTIONS
    // ==========================================

    toggleAdvanced() {
        this.advancedOptions.classList.toggle('show');
        this.advancedToggle.classList.toggle('active');
    }

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================

    showToast(message, type = 'info') {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="${icons[type]} toast-icon"></i>
            <span>${message}</span>
        `;

        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // ==========================================
    // UTILITIES
    // ==========================================

    setLoading(loading) {
        if (loading) {
            this.shortenBtn.classList.add('loading');
            this.shortenBtn.disabled = true;
        } else {
            this.shortenBtn.classList.remove('loading');
            this.shortenBtn.disabled = false;
        }
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatDateShort(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new URLShortener();
});