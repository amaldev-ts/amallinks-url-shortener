// ==========================================
// ADMIN DASHBOARD APPLICATION
// ==========================================

class AdminDashboard {
    constructor() {
        this.token = localStorage.getItem('adminToken');
        this.currentPage = 1;
        this.searchQuery = '';
        this.statusFilter = 'all';
        this.debounceTimer = null;

        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.loadTheme();

        if (this.token) {
            this.showDashboard();
            this.loadDashboard();
        }
    }

    bindElements() {
        // Containers
        this.loginContainer = document.getElementById('loginContainer');
        this.dashboardContainer = document.getElementById('dashboardContainer');

        // Auth
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');
        this.loginTabs = document.querySelectorAll('.login-tab');

        // Dashboard
        this.refreshBtn = document.getElementById('refreshBtn');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.searchInput = document.getElementById('searchInput');
        this.statusFilterEl = document.getElementById('statusFilter');
        this.urlTableBody = document.getElementById('urlTableBody');
        this.pagination = document.getElementById('pagination');

        // Theme
        this.themeToggle = document.getElementById('themeToggle');
        this.toastContainer = document.getElementById('toastContainer');
    }

    bindEvents() {
        // Login tabs
        this.loginTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Auth forms
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));

        // Dashboard actions
        this.refreshBtn.addEventListener('click', () => this.loadDashboard());
        this.logoutBtn.addEventListener('click', () => this.logout());

        // Search and filter
        this.searchInput.addEventListener('input', () => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.searchQuery = this.searchInput.value.trim();
                this.currentPage = 1;
                this.loadUrls();
            }, 400);
        });

        this.statusFilterEl.addEventListener('change', () => {
            this.statusFilter = this.statusFilterEl.value;
            this.currentPage = 1;
            this.loadUrls();
        });

        // Theme
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // ==========================================
    // AUTHENTICATION
    // ==========================================

    switchTab(tab) {
        this.loginTabs.forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

        if (tab === 'login') {
            this.loginForm.style.display = 'flex';
            this.registerForm.style.display = 'none';
        } else {
            this.loginForm.style.display = 'none';
            this.registerForm.style.display = 'flex';
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const btn = this.loginForm.querySelector('.btn-shorten');
        btn.classList.add('loading');
        btn.disabled = true;

        try {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error);

            this.token = data.token;
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminName', data.username);

            this.showToast(`Welcome back, ${data.username}!`, 'success');
            this.showDashboard();
            this.loadDashboard();

        } catch (error) {
            this.showToast(error.message, 'error');
        } finally {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const btn = this.registerForm.querySelector('.btn-shorten');
        btn.classList.add('loading');
        btn.disabled = true;

        try {
            const username = document.getElementById('regUsername').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const setupKey = document.getElementById('regSetupKey').value;

            const response = await fetch('/api/admin/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, setupKey })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error);

            this.token = data.token;
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminName', data.username);

            this.showToast('Account created successfully!', 'success');
            this.showDashboard();
            this.loadDashboard();

        } catch (error) {
            this.showToast(error.message, 'error');
        } finally {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    logout() {
        this.token = null;
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminName');
        this.showLogin();
        this.showToast('Logged out successfully', 'info');
    }

    showDashboard() {
        this.loginContainer.style.display = 'none';
        this.dashboardContainer.style.display = 'block';
    }

    showLogin() {
        this.loginContainer.style.display = 'block';
        this.dashboardContainer.style.display = 'none';
    }

    // ==========================================
    // DASHBOARD DATA
    // ==========================================

    async loadDashboard() {
        try {
            const response = await fetch('/api/admin/dashboard', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.status === 401) {
                this.logout();
                this.showToast('Session expired. Please login again.', 'error');
                return;
            }

            const data = await response.json();

            if (!response.ok) throw new Error(data.error);

            // Update stats
            this.animateCounter('dashTotalUrls', data.totalUrls);
            this.animateCounter('dashActiveUrls', data.activeUrls);
            this.animateCounter('dashTotalClicks', data.totalClicks);
            this.animateCounter('dashTodayUrls', data.todayUrls);
            this.animateCounter('dashExpiredUrls', data.expiredUrls);

            // Load URLs table
            this.loadUrls();

        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async loadUrls() {
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: 15,
                search: this.searchQuery,
                status: this.statusFilter
            });

            const response = await fetch(`/api/admin/urls?${params}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.status === 401) {
                this.logout();
                return;
            }

            const data = await response.json();

            if (!response.ok) throw new Error(data.error);

            this.renderUrlTable(data.urls);
            this.renderPagination(data.pagination);

        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    // ==========================================
    // RENDER TABLE
    // ==========================================

    renderUrlTable(urls) {
        if (!urls.length) {
            this.urlTableBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <h3>No URLs found</h3>
                            <p>Try adjusting your search or filters</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        this.urlTableBody.innerHTML = urls.map(url => {
            const isExpired = url.expiresAt && new Date(url.expiresAt) < new Date();
            let statusClass = url.isActive ? 'active' : 'inactive';
            let statusText = url.isActive ? 'Active' : 'Inactive';

            if (isExpired) {
                statusClass = 'expired';
                statusText = 'Expired';
            }

            const shortUrl = `${window.location.origin}/${url.shortId}`;

            return `
                <tr>
                    <td>
                        <a href="${shortUrl}" target="_blank" class="short-link">
                            /${url.shortId}
                        </a>
                    </td>
                    <td class="url-cell" title="${url.originalUrl}">
                        ${url.originalUrl}
                    </td>
                    <td>
                        <strong>${url.clickCount.toLocaleString()}</strong>
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            <i class="fas fa-circle" style="font-size: 6px;"></i>
                            ${statusText}
                        </span>
                    </td>
                    <td>${this.formatDateCompact(url.createdAt)}</td>
                    <td>${url.expiresAt ? this.formatDateCompact(url.expiresAt) : '<span style="color: var(--text-muted);">Never</span>'}</td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn toggle" onclick="dashboard.toggleUrl('${url._id}')" title="${url.isActive ? 'Deactivate' : 'Activate'}">
                                <i class="fas fa-${url.isActive ? 'pause' : 'play'}"></i>
                            </button>
                            <button class="action-btn delete" onclick="dashboard.deleteUrl('${url._id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderPagination(pagination) {
        if (pagination.pages <= 1) {
            this.pagination.innerHTML = '';
            return;
        }

        let html = '';

        html += `<button class="page-btn" ${pagination.current === 1 ? 'disabled' : ''} onclick="dashboard.goToPage(${pagination.current - 1})">
            <i class="fas fa-chevron-left"></i>
        </button>`;

        for (let i = 1; i <= pagination.pages; i++) {
            if (
                i === 1 ||
                i === pagination.pages ||
                (i >= pagination.current - 2 && i <= pagination.current + 2)
            ) {
                html += `<button class="page-btn ${i === pagination.current ? 'active' : ''}" onclick="dashboard.goToPage(${i})">${i}</button>`;
            } else if (i === pagination.current - 3 || i === pagination.current + 3) {
                html += `<span style="color: var(--text-muted); padding: 0 8px;">...</span>`;
            }
        }

        html += `<button class="page-btn" ${pagination.current === pagination.pages ? 'disabled' : ''} onclick="dashboard.goToPage(${pagination.current + 1})">
            <i class="fas fa-chevron-right"></i>
        </button>`;

        html += `<span style="color: var(--text-muted); font-size: 12px; margin-left: 12px;">${pagination.total} total</span>`;

        this.pagination.innerHTML = html;
    }

    // ==========================================
    // URL ACTIONS
    // ==========================================

    async toggleUrl(id) {
        try {
            const response = await fetch(`/api/admin/urls/${id}/toggle`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            this.showToast(`URL ${data.isActive ? 'activated' : 'deactivated'}`, 'success');
            this.loadUrls();

        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async deleteUrl(id) {
        if (!confirm('Are you sure you want to delete this URL? This action cannot be undone.')) return;

        try {
            const response = await fetch(`/api/admin/urls/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            this.showToast('URL deleted successfully', 'success');
            this.loadDashboard();

        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadUrls();
        document.querySelector('.urls-section').scrollIntoView({ behavior: 'smooth' });
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
    // UTILITIES
    // ==========================================

    animateCounter(elementId, target) {
        const el = document.getElementById(elementId);
        const start = parseInt(el.textContent) || 0;
        const duration = 800;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic

            el.textContent = Math.round(start + (target - start) * eased).toLocaleString();

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    formatDateCompact(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: '2-digit'
        });
    }

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
}

// Initialize
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new AdminDashboard();
});