// ==========================================================================
// cPanel Backup Wizard
// ==========================================================================

const backupWizard = {
  init() {
    this.setupListeners();
  },

  async open() {
    cPanelApp.openModal('modal-backups');
    await this.loadBackups();
  },

  async loadBackups() {
    const tbody = document.getElementById('backups-tbody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading backups...</td></tr>';

    try {
      const data = await cPanelApp.api('/api/backups');
      if (data.backups.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No backups generated yet.</td></tr>';
        return;
      }

      tbody.innerHTML = data.backups.map(b => `
        <tr>
          <td><i class="fa-solid fa-file-zipper text-primary" style="margin-right:8px;"></i><strong>${b.fileName}</strong></td>
          <td>${b.sizeMB} MB</td>
          <td>${new Date(b.createdAt).toLocaleString()}</td>
          <td style="text-align:right;">
            <a href="/api/backups/download/${encodeURIComponent(b.fileName)}" class="btn-primary btn-sm">
              <i class="fa-solid fa-download"></i> Download
            </a>
          </td>
        </tr>
      `).join('');

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
  },

  async triggerFullBackup() {
    const btn = document.getElementById('btn-create-backup');
    const statusBox = document.getElementById('backup-progress-status');
    const bar = document.getElementById('backup-progress-fill');

    btn.disabled = true;
    statusBox.style.display = 'block';
    bar.style.width = '30%';
    document.getElementById('backup-status-text').textContent = 'Dumping XAMPP MySQL databases (mysqldump) & packing htdocs files...';

    try {
      const res = await cPanelApp.api('/api/backups/create', { method: 'POST' });
      bar.style.width = '100%';
      document.getElementById('backup-status-text').textContent = `Backup Complete! (${res.fileName} - ${res.sizeMB} MB)`;
      cPanelApp.showToast(`Full Backup generated: ${res.fileName}`, 'success');

      setTimeout(() => {
        statusBox.style.display = 'none';
        btn.disabled = false;
        this.loadBackups();
      }, 1500);

    } catch (err) {
      document.getElementById('backup-status-text').textContent = `Error: ${err.message}`;
      cPanelApp.showToast(err.message, 'error');
      btn.disabled = false;
    }
  },

  setupListeners() {
    const btn = document.getElementById('btn-create-backup');
    if (btn) btn.onclick = () => this.triggerFullBackup();
  }
};

window.backupWizard = backupWizard;
document.addEventListener('DOMContentLoaded', () => backupWizard.init());
