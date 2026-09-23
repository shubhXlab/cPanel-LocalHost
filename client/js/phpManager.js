// ==========================================================================
// cPanel MultiPHP & php.ini Editor
// ==========================================================================

const phpManager = {
  init() {
    this.setupListeners();
  },

  async open() {
    cPanelApp.openModal('modal-php');
    await this.loadPhpInfo();
    await this.loadPhpIni();
  },

  async loadPhpInfo() {
    try {
      const data = await cPanelApp.api('/api/software/php');
      document.getElementById('php-detected-version').textContent = data.version;
      document.getElementById('php-ini-filepath').textContent = data.iniPath;

      const extList = document.getElementById('php-extensions-list');
      if (extList) {
        extList.innerHTML = data.extensions.map(ext => `
          <span class="service-badge" style="font-size:11px; margin:2px;">${ext}</span>
        `).join('');
      }
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  async loadPhpIni() {
    try {
      const data = await cPanelApp.api('/api/software/php-ini');
      if (!data.exists) {
        cPanelApp.showToast('php.ini file not found in XAMPP directory', 'error');
        return;
      }

      const s = data.settings;
      document.getElementById('php-memory-limit').value = s.memory_limit || '512M';
      document.getElementById('php-upload-max').value = s.upload_max_filesize || '40M';
      document.getElementById('php-post-max').value = s.post_max_size || '40M';
      document.getElementById('php-max-exec').value = s.max_execution_time || '120';
      document.getElementById('php-display-errors').value = s.display_errors || 'On';

    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  async savePhpIni(e) {
    e.preventDefault();
    const settings = {
      memory_limit: document.getElementById('php-memory-limit').value.trim(),
      upload_max_filesize: document.getElementById('php-upload-max').value.trim(),
      post_max_size: document.getElementById('php-post-max').value.trim(),
      max_execution_time: document.getElementById('php-max-exec').value.trim(),
      display_errors: document.getElementById('php-display-errors').value
    };

    try {
      const res = await cPanelApp.api('/api/software/php-ini', {
        method: 'POST',
        body: { settings }
      });

      cPanelApp.showToast(res.message || 'php.ini saved!', 'success');

      // Offer Apache restart
      if (confirm('php.ini changes saved! Would you like to restart Apache now to apply new settings?')) {
        await cPanelApp.api('/api/xampp/apache/restart', { method: 'POST' });
        cPanelApp.showToast('Apache restarted with new PHP directives!', 'success');
      }

    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  setupListeners() {
    const form = document.getElementById('form-php-ini');
    if (form) form.onsubmit = (e) => this.savePhpIni(e);
  }
};

window.phpManager = phpManager;
document.addEventListener('DOMContentLoaded', () => phpManager.init());
