// ==========================================================================
// cPanel Metrics, Server Logs & Security Tools
// Independent Controllers for Errors, Raw Access, Resource Usage, Visitors
// ==========================================================================

const metricsApp = {
  cachedErrors: [],
  cachedRawAccess: [],
  cachedAudit: [],
  cachedVisitors: [],

  init() {
    this.setupListeners();
  },

  // --------------------------------------------------------------------------
  // 1. ERRORS TOOL
  // --------------------------------------------------------------------------
  async openErrors() {
    cPanelApp.openModal('modal-errors');
    await this.loadErrors();
  },

  // Alias for backward compatibility
  async openLogs() {
    await this.openErrors();
  },

  async loadErrors() {
    const tbody = document.getElementById('errors-tbody');
    const source = (document.getElementById('errors-source-sel') || {}).value || 'apache';
    const limit = (document.getElementById('errors-limit-sel') || {}).value || '100';
    const filter = (document.getElementById('errors-filter-input') || {}).value || '';

    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Reading error log entries...</td></tr>';
    }

    try {
      const data = await cPanelApp.api(`/api/metrics/errors?source=${encodeURIComponent(source)}&lines=${encodeURIComponent(limit)}&filter=${encodeURIComponent(filter)}`);
      this.cachedErrors = data.entries || [];

      // Update counters
      const totalEl = document.getElementById('err-badge-total');
      const errEl = document.getElementById('err-badge-errors');
      const warnEl = document.getElementById('err-badge-warns');
      const notEl = document.getElementById('err-badge-notices');

      if (totalEl) totalEl.textContent = `${data.totalEntries || 0} entries`;
      if (errEl) errEl.textContent = `${(data.counts && data.counts.error) || 0} errors`;
      if (warnEl) warnEl.textContent = `${(data.counts && data.counts.warn) || 0} warnings`;
      if (notEl) notEl.textContent = `${(data.counts && data.counts.notice) || 0} notices`;

      this.renderErrorsTable(this.cachedErrors);
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
  },

  filterErrors(q) {
    if (!this.cachedErrors) return;
    const query = (q || '').toLowerCase().trim();
    if (!query) {
      this.renderErrorsTable(this.cachedErrors);
      return;
    }
    const filtered = this.cachedErrors.filter(e =>
      (e.message && e.message.toLowerCase().includes(query)) ||
      (e.client && e.client.toLowerCase().includes(query)) ||
      (e.level && e.level.toLowerCase().includes(query)) ||
      (e.timestamp && e.timestamp.toLowerCase().includes(query))
    );
    this.renderErrorsTable(filtered);
  },

  renderErrorsTable(entries) {
    const tbody = document.getElementById('errors-tbody');
    if (!tbody) return;

    if (!entries || entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:24px;">No error log entries match the criteria. Everything is running cleanly!</td></tr>';
      return;
    }

    tbody.innerHTML = entries.map(e => {
      let badgeStyle = 'background:#fef2f2; color:#b91c1c; border-color:#fecaca;'; // error
      if (e.level === 'warn') {
        badgeStyle = 'background:#fffbeb; color:#b45309; border-color:#fde68a;';
      } else if (e.level === 'notice') {
        badgeStyle = 'background:#f8fafc; color:#475569; border-color:#cbd5e1;';
      }

      return `
        <tr>
          <td style="font-size:11px; color:#64748b; white-space:nowrap;">${e.timestamp || '-'}</td>
          <td><span class="service-badge" style="font-size:10px; font-weight:700; text-transform:uppercase; ${badgeStyle}">[${e.level}]</span></td>
          <td style="font-size:11px; color:#475569;"><code>${e.client || '-'}</code></td>
          <td style="font-size:12px; word-break:break-all; font-family:Consolas, monospace;">${e.message || e.raw}</td>
        </tr>
      `;
    }).join('');
  },

  downloadErrorLog() {
    const source = (document.getElementById('errors-source-sel') || {}).value || 'apache';
    window.open(`/api/metrics/logs/download?type=${encodeURIComponent(source)}`, '_blank');
  },

  // --------------------------------------------------------------------------
  // 2. RAW ACCESS & AUDIT TOOL
  // --------------------------------------------------------------------------
  async openRawAccess() {
    cPanelApp.openModal('modal-raw-access');
    await this.loadRawAccess();
  },

  // Alias for backward compatibility
  async openAudit() {
    cPanelApp.openModal('modal-raw-access');
    this.switchRawAccessTab('audit');
  },

  switchRawAccessTab(tab) {
    const paneAccess = document.getElementById('pane-raw-access');
    const paneAudit = document.getElementById('pane-audit-trail');
    const tabBtnAccess = document.getElementById('tab-btn-raw-access');
    const tabBtnAudit = document.getElementById('tab-btn-audit');

    if (tab === 'access') {
      if (paneAccess) paneAccess.style.display = 'block';
      if (paneAudit) paneAudit.style.display = 'none';
      if (tabBtnAccess) {
        tabBtnAccess.style.color = 'var(--cp-orange)';
        tabBtnAccess.style.borderBottom = '2px solid var(--cp-orange)';
      }
      if (tabBtnAudit) {
        tabBtnAudit.style.color = '#64748b';
        tabBtnAudit.style.borderBottom = 'none';
      }
      this.loadRawAccess();
    } else {
      if (paneAccess) paneAccess.style.display = 'none';
      if (paneAudit) paneAudit.style.display = 'block';
      if (tabBtnAudit) {
        tabBtnAudit.style.color = 'var(--cp-orange)';
        tabBtnAudit.style.borderBottom = '2px solid var(--cp-orange)';
      }
      if (tabBtnAccess) {
        tabBtnAccess.style.color = '#64748b';
        tabBtnAccess.style.borderBottom = 'none';
      }
      this.loadAudit();
    }
  },

  async loadRawAccess() {
    const tbody = document.getElementById('raw-access-tbody');
    const limit = (document.getElementById('raw-access-lines-sel') || {}).value || '100';
    const filter = (document.getElementById('raw-access-filter-input') || {}).value || '';

    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Streaming Apache HTTP access logs...</td></tr>';
    }

    try {
      const data = await cPanelApp.api(`/api/metrics/raw-access?lines=${encodeURIComponent(limit)}&filter=${encodeURIComponent(filter)}`);
      this.cachedRawAccess = data.entries || [];
      this.renderRawAccessTable(this.cachedRawAccess);
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
  },

  filterRawAccess(q) {
    if (!this.cachedRawAccess) return;
    const query = (q || '').toLowerCase().trim();
    if (!query) {
      this.renderRawAccessTable(this.cachedRawAccess);
      return;
    }
    const filtered = this.cachedRawAccess.filter(e =>
      (e.ip && e.ip.toLowerCase().includes(query)) ||
      (e.path && e.path.toLowerCase().includes(query)) ||
      (e.method && e.method.toLowerCase().includes(query)) ||
      String(e.status).includes(query) ||
      (e.userAgent && e.userAgent.toLowerCase().includes(query))
    );
    this.renderRawAccessTable(filtered);
  },

  renderRawAccessTable(entries) {
    const tbody = document.getElementById('raw-access-tbody');
    if (!tbody) return;

    if (!entries || entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:24px;">No HTTP access requests recorded yet. Make a request to localhost to see the stream!</td></tr>';
      return;
    }

    tbody.innerHTML = entries.map(e => {
      let statusStyle = 'background:#ecfdf5; color:#059669; border-color:#a7f3d0;'; // 2xx
      if (e.status >= 300 && e.status < 400) statusStyle = 'background:#eff6ff; color:#2563eb; border-color:#bfdbfe;';
      else if (e.status >= 400 && e.status < 500) statusStyle = 'background:#fffbeb; color:#b45309; border-color:#fde68a;';
      else if (e.status >= 500) statusStyle = 'background:#fef2f2; color:#b91c1c; border-color:#fecaca;';

      const bytesFormatted = e.bytes >= 1024 ? `${(e.bytes / 1024).toFixed(1)} KB` : `${e.bytes} B`;

      return `
        <tr>
          <td><code style="font-weight:600;">${e.ip}</code></td>
          <td><span style="font-weight:700; font-size:11px; padding:2px 6px; background:#f1f5f9; border-radius:4px;">${e.method}</span></td>
          <td><code style="color:#0369a1;">${e.path}</code></td>
          <td><span class="service-badge" style="${statusStyle}">${e.status}</span></td>
          <td>${bytesFormatted}</td>
          <td style="font-size:11px; color:#64748b; white-space:nowrap;">${e.time}</td>
          <td style="font-size:11px; color:#64748b; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${e.userAgent}">${e.userAgent}</td>
        </tr>
      `;
    }).join('');
  },

  async loadAudit() {
    const tbody = document.getElementById('audit-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading administrative audit trail...</td></tr>';

    try {
      const data = await cPanelApp.api('/api/metrics/audit?limit=100');
      this.cachedAudit = data.logs || [];
      this.renderAuditTable(this.cachedAudit);
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
  },

  filterAudit(q) {
    if (!this.cachedAudit) return;
    const query = (q || '').toLowerCase().trim();
    if (!query) {
      this.renderAuditTable(this.cachedAudit);
      return;
    }
    const filtered = this.cachedAudit.filter(l =>
      (l.action && l.action.toLowerCase().includes(query)) ||
      (l.details && l.details.toLowerCase().includes(query)) ||
      (l.ip && l.ip.toLowerCase().includes(query))
    );
    this.renderAuditTable(filtered);
  },

  renderAuditTable(logs) {
    const tbody = document.getElementById('audit-tbody');
    if (!tbody) return;

    if (!logs || logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:20px;">No administrative audit activities logged yet.</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td><span class="service-badge" style="font-weight:700;">${l.action}</span></td>
        <td>${l.details}</td>
        <td><code>${l.ip}</code></td>
        <td style="font-size:11px; color:#64748b;">${new Date(l.timestamp).toLocaleString()}</td>
      </tr>
    `).join('');
  },

  downloadRawAccessLog() {
    window.open('/api/metrics/logs/download?type=access', '_blank');
  },

  // --------------------------------------------------------------------------
  // 3. RESOURCE USAGE TOOL
  // --------------------------------------------------------------------------
  async openResourceUsage() {
    cPanelApp.openModal('modal-resource-usage');
    await this.loadResourceUsage();
  },

  async loadResourceUsage() {
    const alertBox = document.getElementById('resource-status-alert');
    const alertTitle = document.getElementById('resource-status-title');
    const alertDesc = document.getElementById('resource-status-desc');

    const cpuVal = document.getElementById('res-cpu-val');
    const cpuBar = document.getElementById('res-cpu-bar');
    const cpuCores = document.getElementById('res-cpu-cores');

    const ramVal = document.getElementById('res-ram-val');
    const ramBar = document.getElementById('res-ram-bar');
    const ramDetail = document.getElementById('res-ram-detail');

    const diskVal = document.getElementById('res-disk-val');
    const diskBar = document.getElementById('res-disk-bar');
    const diskDetail = document.getElementById('res-disk-detail');

    const inodesVal = document.getElementById('res-inodes-val');
    const inodesBar = document.getElementById('res-inodes-bar');

    const procTbody = document.getElementById('res-processes-tbody');
    if (procTbody) procTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Querying Windows processes...</td></tr>';

    try {
      const data = await cPanelApp.api('/api/metrics/resource-usage');

      if (alertBox && alertTitle && alertDesc) {
        if (data.isThrottled) {
          alertBox.style.background = '#fef2f2';
          alertBox.style.borderColor = '#fecaca';
          alertBox.style.color = '#991b1b';
          alertTitle.textContent = 'High Resource Utilization';
          alertDesc.textContent = data.message;
        } else {
          alertBox.style.background = '#ecfdf5';
          alertBox.style.borderColor = '#a7f3d0';
          alertBox.style.color = '#065f46';
          alertTitle.textContent = 'Normal Resource Status';
          alertDesc.textContent = data.message;
        }
      }

      // CPU
      if (cpuVal) cpuVal.textContent = `${data.cpu.percent}%`;
      if (cpuBar) {
        cpuBar.style.width = `${data.cpu.percent}%`;
        cpuBar.className = data.cpu.percent > 85 ? 'progress-bar-fill danger' : 'progress-bar-fill';
      }
      if (cpuCores) cpuCores.textContent = `${data.cpu.cores} Cores (${data.cpu.model})`;

      // RAM
      if (ramVal) ramVal.textContent = `${data.memory.percent}%`;
      if (ramBar) {
        ramBar.style.width = `${data.memory.percent}%`;
        ramBar.className = data.memory.percent > 85 ? 'progress-bar-fill danger' : 'progress-bar-fill';
      }
      if (ramDetail) ramDetail.textContent = `${data.memory.usedGB} GB Used / ${data.memory.totalGB} GB Total`;

      // Disk
      if (diskVal) diskVal.textContent = `${data.disk.percent}%`;
      if (diskBar) {
        diskBar.style.width = `${data.disk.percent}%`;
        diskBar.className = data.disk.percent > 85 ? 'progress-bar-fill danger' : 'progress-bar-fill';
      }
      if (diskDetail) diskDetail.textContent = `${data.disk.usedGB} GB Used / ${data.disk.totalGB} GB Total`;

      // Inodes
      if (inodesVal) inodesVal.textContent = data.inodes.used.toLocaleString();
      if (inodesBar) inodesBar.style.width = `${data.inodes.percent}%`;

      // Processes
      if (procTbody) {
        if (!data.processes || data.processes.length === 0) {
          procTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No stack processes identified.</td></tr>';
        } else {
          procTbody.innerHTML = data.processes.map(p => `
            <tr>
              <td>
                <i class="fa-solid fa-gear text-primary" style="margin-right:8px;"></i>
                <strong>${p.name}</strong>
              </td>
              <td><code>${p.pid}</code></td>
              <td><strong>${p.memMB} MB</strong> <span style="font-size:11px; color:#94a3b8;">(${p.memKB})</span></td>
              <td>${p.session || 'Console'}</td>
              <td style="text-align:right;">
                <span class="service-badge" style="background:#ecfdf5; color:#059669; border-color:#a7f3d0;"><i class="fa-solid fa-circle-check"></i> ${p.status}</span>
              </td>
            </tr>
          `).join('');
        }
      }

    } catch (err) {
      if (procTbody) procTbody.innerHTML = `<tr><td colspan="5" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
      cPanelApp.showToast(`Resource Usage: ${err.message}`, 'error');
    }
  },

  // --------------------------------------------------------------------------
  // 4. VISITORS TOOL
  // --------------------------------------------------------------------------
  async openVisitors() {
    cPanelApp.openModal('modal-visitors');
    await this.loadVisitors();
  },

  async loadVisitors() {
    const tbody = document.getElementById('visitors-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Compiling visitor logs...</td></tr>';

    try {
      const data = await cPanelApp.api('/api/metrics/visitors?limit=300');
      this.cachedVisitors = data.visitors || [];

      // Update KPI Cards
      const sum = data.summary || {};
      const kpiReq = document.getElementById('vis-kpi-requests');
      const kpiUni = document.getElementById('vis-kpi-unique');
      const kpiByte = document.getElementById('vis-kpi-bytes');
      const kpiStat = document.getElementById('vis-kpi-status');

      if (kpiReq) kpiReq.textContent = (sum.totalRequests || 0).toLocaleString();
      if (kpiUni) kpiUni.textContent = (sum.uniqueVisitors || 0).toLocaleString();
      if (kpiByte) kpiByte.textContent = sum.totalBytesFormatted || '0 KB';
      if (kpiStat && sum.statusCounts) {
        kpiStat.textContent = `2xx: ${sum.statusCounts['2xx'] || 0} | 3xx: ${sum.statusCounts['3xx'] || 0} | 4xx: ${sum.statusCounts['4xx'] || 0}`;
      }

      this.filterVisitors(document.getElementById('visitors-filter-input') ? document.getElementById('visitors-filter-input').value : '');
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
  },

  filterVisitors(query = '') {
    if (!this.cachedVisitors) return;
    const q = (query || '').toLowerCase().trim();
    const statusFilter = (document.getElementById('visitors-status-filter') || {}).value || 'all';

    let list = this.cachedVisitors;

    if (statusFilter !== 'all') {
      const targetPrefix = statusFilter.slice(0, 1); // e.g. '2' from '2xx'
      list = list.filter(v => String(v.status).startsWith(targetPrefix));
    }

    if (q) {
      list = list.filter(v =>
        (v.ip && v.ip.toLowerCase().includes(q)) ||
        (v.path && v.path.toLowerCase().includes(q)) ||
        (v.userAgent && v.userAgent.toLowerCase().includes(q)) ||
        String(v.status).includes(q)
      );
    }

    this.renderVisitorsTable(list);
  },

  renderVisitorsTable(entries) {
    const tbody = document.getElementById('visitors-tbody');
    if (!tbody) return;

    if (!entries || entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:24px;">No visitors matching the criteria. Browse your website on localhost to generate visitor logs!</td></tr>';
      return;
    }

    tbody.innerHTML = entries.map(v => {
      let statusStyle = 'background:#ecfdf5; color:#059669; border-color:#a7f3d0;';
      if (v.status >= 300 && v.status < 400) statusStyle = 'background:#eff6ff; color:#2563eb; border-color:#bfdbfe;';
      else if (v.status >= 400 && v.status < 500) statusStyle = 'background:#fffbeb; color:#b45309; border-color:#fde68a;';
      else if (v.status >= 500) statusStyle = 'background:#fef2f2; color:#b91c1c; border-color:#fecaca;';

      const sizeFormatted = v.bytes >= 1024 ? `${(v.bytes / 1024).toFixed(1)} KB` : `${v.bytes} B`;

      let browserName = 'Browser';
      const ua = v.userAgent || '';
      if (ua.includes('Edg/')) browserName = 'Microsoft Edge';
      else if (ua.includes('Chrome/')) browserName = 'Google Chrome';
      else if (ua.includes('Firefox/')) browserName = 'Mozilla Firefox';
      else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browserName = 'Apple Safari';
      else if (ua.includes('bot') || ua.includes('crawl')) browserName = 'Web Bot';

      return `
        <tr>
          <td><code style="font-weight:600;">${v.ip}</code></td>
          <td><code style="color:#0369a1;">${v.path}</code></td>
          <td><span class="service-badge" style="${statusStyle}">${v.method} ${v.status}</span></td>
          <td style="font-size:11px; color:#64748b; white-space:nowrap;">${v.time}</td>
          <td>${sizeFormatted}</td>
          <td style="font-size:11px; color:#64748b; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${v.referer}">${v.referer}</td>
          <td><span style="font-size:11px; font-weight:600; color:#475569;"><i class="fa-solid fa-globe"></i> ${browserName}</span></td>
        </tr>
      `;
    }).join('');
  },

  // --------------------------------------------------------------------------
  // 5. OTHER TOOLS: DISK USAGE, SERVER INFO, 2FA
  // --------------------------------------------------------------------------
  async openDiskUsage() {
    cPanelApp.openModal('modal-disk-usage');
    await this.refreshDiskUsage();
  },

  async refreshDiskUsage() {
    const badge = document.getElementById('disk-modal-badge-status');
    const summaryText = document.getElementById('disk-modal-summary-text');
    const meterFill = document.getElementById('disk-modal-meter-fill');
    const statUsed = document.getElementById('disk-stat-used');
    const statFree = document.getElementById('disk-stat-free');
    const statTotal = document.getElementById('disk-stat-total');
    const statFiles = document.getElementById('disk-stat-files');

    const compHtdocs = document.getElementById('disk-comp-htdocs-val');
    const compMysql = document.getElementById('disk-comp-mysql-val');
    const compLogs = document.getElementById('disk-comp-logs-val');
    const compBackups = document.getElementById('disk-comp-backups-val');

    const foldersTbody = document.getElementById('disk-folders-tbody');
    const dbsTbody = document.getElementById('disk-dbs-tbody');

    if (badge) badge.textContent = 'Calculating...';
    if (foldersTbody) foldersTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Calculating folder sizes...</td></tr>';
    if (dbsTbody) dbsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading database stats...</td></tr>';

    try {
      const data = await cPanelApp.api('/api/metrics/disk-usage');
      const sum = data.summary;
      const disk = data.disk;

      if (badge) badge.textContent = `${disk.percent}% Used`;
      if (summaryText) summaryText.textContent = `${disk.usedGB} GB of ${disk.totalGB} GB Used (${disk.percent}%)`;
      if (meterFill) {
        meterFill.style.width = `${disk.percent}%`;
        meterFill.className = disk.percent > 90 ? 'progress-bar-fill danger' : (disk.percent > 70 ? 'progress-bar-fill warning' : 'progress-bar-fill');
      }
      if (statUsed) statUsed.textContent = `${disk.usedGB} GB (${disk.percent}%)`;
      if (statFree) statFree.textContent = `${disk.freeGB} GB`;
      if (statTotal) statTotal.textContent = `${disk.totalGB} GB`;
      if (statFiles) statFiles.textContent = `${sum.webRootFiles.toLocaleString()} files`;

      if (compHtdocs) compHtdocs.textContent = `${sum.webRootMB} MB (${sum.webRootFiles} files)`;
      if (compMysql) compMysql.textContent = `${sum.mysqlMB} MB (${sum.mysqlDatabases} DBs)`;
      if (compLogs) compLogs.textContent = `${sum.logsMB} MB (${sum.logsFiles} logs)`;
      if (compBackups) compBackups.textContent = `${sum.backupsMB} MB (${sum.backupsFiles} files)`;

      if (foldersTbody) {
        if (!data.webDirectories || data.webDirectories.length === 0) {
          foldersTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No subdirectories found in public_html.</td></tr>';
        } else {
          foldersTbody.innerHTML = data.webDirectories.map(dir => `
            <tr>
              <td><i class="fa-solid fa-folder text-warning" style="margin-right:8px;"></i><strong>${dir.name}</strong></td>
              <td><code>${dir.path}</code></td>
              <td><strong>${dir.sizeMB >= 1 ? dir.sizeMB + ' MB' : (dir.sizeBytes / 1024).toFixed(1) + ' KB'}</strong></td>
              <td>${dir.files.toLocaleString()} files</td>
              <td>
                <button class="btn-secondary btn-sm" onclick="cPanelApp.closeModal('modal-disk-usage'); fileManager.open(); fileManager.navigateTo('${dir.path}');">
                  <i class="fa-solid fa-folder-open"></i> Browse
                </button>
              </td>
            </tr>
          `).join('');
        }
      }

      if (dbsTbody) {
        if (!data.databases || data.databases.length === 0) {
          dbsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No active databases detected.</td></tr>';
        } else {
          dbsTbody.innerHTML = data.databases.map(db => `
            <tr>
              <td><i class="fa-solid fa-database text-primary" style="margin-right:8px;"></i><strong>${db.name}</strong></td>
              <td><strong>${db.sizeMB} MB</strong></td>
              <td>${db.tableCount} tables</td>
              <td>
                <button class="btn-secondary btn-sm" onclick="window.open('http://127.0.0.1/phpmyadmin/index.php?route=/database/structure&db=' + encodeURIComponent('${db.name}'), '_blank');">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i> phpMyAdmin
                </button>
              </td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      if (badge) badge.textContent = 'Error';
      if (foldersTbody) foldersTbody.innerHTML = `<tr><td colspan="5" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
      if (dbsTbody) dbsTbody.innerHTML = `<tr><td colspan="4" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
      cPanelApp.showToast(`Disk Usage: ${err.message}`, 'error');
    }
  },

  async openServerInfo() {
    cPanelApp.openModal('modal-server-info');
    await this.refreshServerInfo();
  },

  async refreshServerInfo() {
    const tbody = document.getElementById('server-info-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Querying server hardware and software specs...</td></tr>';

    try {
      const data = await cPanelApp.api('/api/metrics/server-info');
      if (tbody) {
        tbody.innerHTML = `
          <tr><td style="width:30%;"><strong>Hosting Platform</strong></td><td><span class="service-badge">${data.cpanelVersion}</span></td></tr>
          <tr><td><strong>Apache Version</strong></td><td>${data.apacheVersion} (Port ${data.apachePort})</td></tr>
          <tr><td><strong>PHP Version</strong></td><td>${data.phpVersion}</td></tr>
          <tr><td><strong>MySQL / MariaDB Version</strong></td><td>${data.mysqlVersion} (Port ${data.mysqlPort})</td></tr>
          <tr><td><strong>Operating System</strong></td><td>${data.os} (${data.architecture})</td></tr>
          <tr><td><strong>Server Hostname</strong></td><td><code>${data.serverName}</code></td></tr>
          <tr><td><strong>Server IP Address</strong></td><td><code>${data.serverIp}:${data.serverPort}</code></td></tr>
          <tr><td><strong>CPU Processor</strong></td><td>${data.cpuModel} (${data.cpuCores} Cores)</td></tr>
          <tr><td><strong>Physical Memory (RAM)</strong></td><td>${data.memoryUsed} Used / ${data.memoryTotal} Total (${data.memoryFree} Free)</td></tr>
          <tr><td><strong>System Uptime</strong></td><td>${data.uptimeHours} Hours</td></tr>
          <tr><td><strong>Web Document Root</strong></td><td><code>${data.pathHtdocs}</code></td></tr>
          <tr><td><strong>Apache Binary</strong></td><td><code>${data.pathApache}</code></td></tr>
          <tr><td><strong>MySQL Daemon</strong></td><td><code>${data.pathMysql}</code></td></tr>
          <tr><td><strong>PHP CLI Binary</strong></td><td><code>${data.pathPhp}</code></td></tr>
        `;
      }
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="2" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
      cPanelApp.showToast(`Server Info: ${err.message}`, 'error');
    }
  },

  async open2FASetup() {
    cPanelApp.openModal('modal-2fa');
    try {
      const data = await cPanelApp.api('/api/auth/2fa/setup', { method: 'POST' });
      document.getElementById('qr-code-img').src = data.qrDataUrl;
      document.getElementById('manual-2fa-secret').textContent = data.secret;
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  async verify2FA(enable) {
    const code = document.getElementById('input-verify-2fa').value.trim();
    if (enable && (!code || code.length !== 6)) {
      cPanelApp.showToast('Please enter the 6-digit code from your authenticator app.', 'error');
      return;
    }
    try {
      const res = await cPanelApp.api('/api/auth/2fa/verify', {
        method: 'POST',
        body: { code, enable }
      });
      cPanelApp.showToast(res.message, 'success');
      cPanelApp.closeModal('modal-2fa');
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  setupListeners() {
    const btnRefreshDisk = document.getElementById('btn-refresh-disk-usage');
    if (btnRefreshDisk) btnRefreshDisk.onclick = () => this.refreshDiskUsage();

    const btnRefreshInfo = document.getElementById('btn-refresh-server-info');
    if (btnRefreshInfo) btnRefreshInfo.onclick = () => this.refreshServerInfo();

    const btnEnable2FA = document.getElementById('btn-enable-2fa');
    if (btnEnable2FA) btnEnable2FA.onclick = () => this.verify2FA(true);

    const btnDisable2FA = document.getElementById('btn-disable-2fa');
    if (btnDisable2FA) btnDisable2FA.onclick = () => this.verify2FA(false);
  }
};

window.metricsApp = metricsApp;
document.addEventListener('DOMContentLoaded', () => metricsApp.init());

