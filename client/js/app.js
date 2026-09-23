// ==========================================================================
// cPanel Core Engine & Dashboard Controller
// ==========================================================================

const cPanelApp = {
  csrfToken: null,
  user: null,
  services: { mysql: {}, apache: {} },

  async init() {
    await this.fetchCsrfToken();
    await this.checkAuth();
    this.setupEventListeners();
    this.setupSearchFilter();
    this.setupCategoryAccordions();
    await this.refreshServiceStatus();
    await this.refreshStats();

    // Auto-refresh service status & stats every 10 seconds
    setInterval(() => {
      this.refreshServiceStatus();
      this.refreshStats();
    }, 10000);
  },

  async fetchCsrfToken() {
    try {
      const res = await fetch('/api/auth/csrf-token');
      const data = await res.json();
      this.csrfToken = data.csrfToken;
    } catch (e) {}
  },

  async checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      this.user = data.user || { username: 'admin', role: 'admin' };
      const userEl = document.getElementById('current-username');
      if (userEl) userEl.textContent = this.user.username;
      const infoEl = document.getElementById('info-user');
      if (infoEl) infoEl.textContent = this.user.username;
    } catch (e) {
      this.user = { username: 'admin', role: 'admin' };
    }
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // Generic secure API fetch helper
  async api(endpoint, options = {}, dataBody = null) {
    let opt = {};
    if (typeof options === 'string') {
      opt = { method: options };
      if (dataBody) opt.body = dataBody;
    } else if (options && typeof options === 'object') {
      opt = Object.assign({}, options);
    }

    const headers = opt.headers || {};
    if (this.csrfToken && opt.method && opt.method !== 'GET') {
      headers['X-CSRF-Token'] = this.csrfToken;
    }
    if (opt.body && typeof opt.body === 'object' && !(opt.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(opt.body);
    }
    opt.headers = headers;

    const res = await fetch(endpoint, opt);
    if (res.status === 401) {
      throw new Error('Unauthorized');
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'API Error');
    }
    return data;
  },

  // Setup Live Tool Search Filter
  setupSearchFilter() {
    const searchInput = document.getElementById('search-tools');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const tiles = document.querySelectorAll('.tool-tile');
      const categories = document.querySelectorAll('.category-card');

      tiles.forEach(tile => {
        const text = tile.textContent.toLowerCase();
        const keywords = tile.getAttribute('data-keywords') || '';
        const match = text.includes(q) || keywords.toLowerCase().includes(q);
        tile.style.display = match ? 'flex' : 'none';
      });

      // Hide category if no visible tiles
      categories.forEach(cat => {
        const visibleTiles = cat.querySelectorAll('.tool-tile:not([style*="display: none"])');
        cat.style.display = visibleTiles.length > 0 ? 'block' : 'none';
      });
    });
  },

  // Category Collapsing / Expanding
  setupCategoryAccordions() {
    document.querySelectorAll('.category-header').forEach(header => {
      header.addEventListener('click', () => {
        const card = header.closest('.category-card');
        card.classList.toggle('collapsed');
      });
    });
  },

  // Service Status Refresher (MySQL & Apache in topbar)
  async refreshServiceStatus() {
    try {
      const status = await this.api('/api/xampp/status');
      this.services = status;

      // MySQL Badge
      const mysqlDot = document.getElementById('mysql-status-dot');
      const mysqlText = document.getElementById('mysql-status-text');
      const mysqlAction = document.getElementById('mysql-action-btn');

      if (status.mysql.running) {
        mysqlDot.className = 'status-dot online';
        mysqlText.textContent = 'MySQL Online';
        mysqlAction.innerHTML = '<i class="fa-solid fa-power-off"></i> Stop';
        mysqlAction.onclick = () => this.stopService('mysql');
      } else {
        mysqlDot.className = 'status-dot offline';
        mysqlText.textContent = 'MySQL Stopped';
        mysqlAction.innerHTML = '<i class="fa-solid fa-play"></i> Start';
        mysqlAction.onclick = () => this.startService('mysql');
      }

      // Apache Badge
      const apacheDot = document.getElementById('apache-status-dot');
      const apacheText = document.getElementById('apache-status-text');
      const apacheAction = document.getElementById('apache-action-btn');

      if (status.apache.running) {
        apacheDot.className = 'status-dot online';
        apacheText.textContent = 'Apache Online';
        apacheAction.innerHTML = '<i class="fa-solid fa-power-off"></i> Stop';
        apacheAction.onclick = () => this.stopService('apache');
      } else {
        apacheDot.className = 'status-dot offline';
        apacheText.textContent = 'Apache Stopped';
        apacheAction.innerHTML = '<i class="fa-solid fa-play"></i> Start';
        apacheAction.onclick = () => this.startService('apache');
      }

      // phpMyAdmin Launcher button
      const pmaTile = document.getElementById('tool-phpmyadmin');
      if (pmaTile) {
        pmaTile.onclick = () => {
          if (!status.mysql.running) {
            cPanelApp.showToast('Starting MySQL before launching phpMyAdmin...', 'info');
            cPanelApp.startService('mysql').then(() => {
              window.open(status.phpMyAdmin.url, '_blank');
            });
          } else {
            window.open(status.phpMyAdmin.url, '_blank');
          }
        };
      }

    } catch (e) {}
  },

  async startService(svc) {
    this.showToast(`Starting ${svc.toUpperCase()}...`, 'info');
    try {
      const res = await this.api(`/api/xampp/${svc}/start`, { method: 'POST' });
      this.showToast(res.message || `${svc.toUpperCase()} started!`, 'success');
      await this.refreshServiceStatus();
      if (window.mysqlManager && svc === 'mysql') window.mysqlManager.loadDatabases();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async stopService(svc) {
    this.showToast(`Stopping ${svc.toUpperCase()}...`, 'info');
    try {
      const res = await this.api(`/api/xampp/${svc}/stop`, { method: 'POST' });
      this.showToast(res.message || `${svc.toUpperCase()} stopped.`, 'info');
      await this.refreshServiceStatus();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // Refresh right-side stats & gauges
  async refreshStats() {
    try {
      const stats = await this.api('/api/metrics/stats');
      
      // Disk
      const diskVal = document.getElementById('stat-disk-val');
      const diskFill = document.getElementById('stat-disk-fill');
      if (diskVal) diskVal.textContent = `${stats.disk.usedGB} GB / ${stats.disk.totalGB} GB (${stats.disk.percent}%)`;
      if (diskFill) {
        diskFill.style.width = `${stats.disk.percent}%`;
        diskFill.className = `progress-bar-fill ${stats.disk.percent > 85 ? 'danger' : (stats.disk.percent > 70 ? 'warning' : 'success')}`;
      }

      // MySQL Disk Usage & Count
      const mysqlVal = document.getElementById('stat-mysql-val');
      const mysqlFill = document.getElementById('stat-mysql-fill');
      if (mysqlVal) mysqlVal.textContent = `${stats.mysql.sizeMB} MB`;
      if (mysqlFill) {
        const mysqlPct = Math.min(100, Math.max(2, Math.round((stats.mysql.sizeMB / 100) * 100)));
        mysqlFill.style.width = `${mysqlPct}%`;
      }

      const dbCountVal = document.getElementById('stat-db-count');
      const dbFill = document.getElementById('stat-db-fill');
      if (dbCountVal) dbCountVal.textContent = `${stats.mysql.dbCount} Databases`;
      if (dbFill) {
        const dbPct = Math.min(100, Math.max(2, stats.mysql.dbCount * 10));
        dbFill.style.width = `${dbPct}%`;
      }

      // Memory
      const memVal = document.getElementById('stat-mem-val');
      const memFill = document.getElementById('stat-mem-fill');
      if (memVal) memVal.textContent = `${stats.memory.usedGB} GB / ${stats.memory.totalGB} GB (${stats.memory.percent}%)`;
      if (memFill) {
        memFill.style.width = `${stats.memory.percent}%`;
        memFill.className = `progress-bar-fill ${stats.memory.percent > 85 ? 'danger' : 'success'}`;
      }

      // File Count (Inodes)
      const inodesVal = document.getElementById('stat-inodes-val');
      const inodesFill = document.getElementById('stat-inodes-fill');
      if (inodesVal) inodesVal.textContent = `${stats.inodes.used.toLocaleString()} files`;
      if (inodesFill) inodesFill.style.width = `${stats.inodes.percent}%`;

      // General Info
      const infoServer = document.getElementById('info-server');
      const infoOs = document.getElementById('info-os');
      if (infoServer) infoServer.textContent = stats.system.hostname;
      if (infoOs) infoOs.textContent = `${stats.system.platform} (${stats.system.cpuCores} Cores)`;

    } catch (e) {}
  },

  // Toast Notification
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${icon}"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  // Open / Close Modal helper
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  },

  copyText(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('Copied to clipboard!', 'info');
      }).catch(() => {
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  },

  fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      this.showToast('Copied to clipboard!', 'info');
    } catch (e) {
      prompt('Copy to clipboard:', text);
    }
    document.body.removeChild(ta);
  },

  setupEventListeners() {
    // User dropdown toggle
    const userMenu = document.getElementById('user-menu-btn');
    const dropdown = document.getElementById('user-dropdown');
    if (userMenu && dropdown) {
      userMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
      });
      document.addEventListener('click', () => {
        dropdown.classList.remove('active');
      });
    }

    // Localhost Access Notice
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        alert('cPanel Localhost runs in direct-access mode. No login or logout is needed.');
      });
    }

    // Modal close buttons
    document.querySelectorAll('.modal-close, [data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });

    // Close modal on click outside (backdrop)
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      }
    });

    // Change Password Form
    const changePassForm = document.getElementById('form-change-password');
    if (changePassForm) {
      changePassForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPass = document.getElementById('input-old-pass').value;
        const newPass = document.getElementById('input-new-pass').value;
        try {
          const res = await cPanelApp.api('/api/auth/change-password', {
            method: 'POST',
            body: { currentPassword: oldPass, newPassword: newPass }
          });
          cPanelApp.showToast(res.message, 'success');
          cPanelApp.closeModal('modal-password');
          document.getElementById('input-old-pass').value = '';
          document.getElementById('input-new-pass').value = '';
        } catch (err) {
          cPanelApp.showToast(err.message, 'error');
        }
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  cPanelApp.init();
});
