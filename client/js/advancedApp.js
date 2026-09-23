/**
 * cPanel Advanced Suite: Cron Jobs, Error Pages, and Track DNS
 */
const advancedApp = {
  currentErrorCode: '400',

  // =========================================================================
  // 1. Cron Jobs Manager
  // =========================================================================
  openCronJobs() {
    cPanelApp.openModal('modal-cron-jobs');
    this.loadCronJobs();
  },

  applyCronPreset(preset) {
    if (!preset) return;
    const parts = preset.trim().split(/\s+/);
    if (parts.length === 5) {
      document.getElementById('cron-min').value = parts[0];
      document.getElementById('cron-hour').value = parts[1];
      document.getElementById('cron-day').value = parts[2];
      document.getElementById('cron-month').value = parts[3];
      document.getElementById('cron-weekday').value = parts[4];
    }
  },

  async loadCronJobs() {
    const tbody = document.getElementById('cron-jobs-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:16px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading scheduled tasks...</td></tr>';
    }

    try {
      const data = await cPanelApp.api('/api/advanced/cron');
      const list = data.cronJobs || [];

      if (!tbody) return;

      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:20px;">No cron jobs scheduled. Use the form above to add an automated command.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(job => {
        let statusBadge = '<span class="badge badge-secondary" style="font-size:10px;">Pending</span>';
        if (job.lastStatus === 'success') {
          statusBadge = '<span class="badge badge-success" style="font-size:10px;"><i class="fa-solid fa-circle-check"></i> OK</span>';
        } else if (job.lastStatus === 'failed') {
          statusBadge = '<span class="badge badge-danger" style="font-size:10px;"><i class="fa-solid fa-circle-xmark"></i> Failed</span>';
        }

        const lastRunStr = job.lastRun ? new Date(job.lastRun).toLocaleString() : 'Never';

        return `
          <tr>
            <td>
              <code style="font-weight:700; font-size:12px; color:#0284c7;">${cPanelApp.escapeHtml(job.schedule)}</code>
            </td>
            <td style="font-size:13px; font-weight:600; color:#1e293b;">
              ${cPanelApp.escapeHtml(job.description || 'Custom Job')}
            </td>
            <td>
              <code style="font-size:11px; color:#475569; word-break:break-all;">${cPanelApp.escapeHtml(job.command)}</code>
            </td>
            <td>
              <div style="display:flex; align-items:center; gap:6px;">
                ${statusBadge}
                <span style="font-size:11px; color:#64748b;">${lastRunStr}</span>
              </div>
            </td>
            <td style="text-align:right; white-space:nowrap;">
              <button class="btn-primary btn-xs" onclick="advancedApp.runCronNow('${job.id}')" title="Test run this cron job immediately">
                <i class="fa-solid fa-play"></i> Run Now
              </button>
              <button class="btn-danger btn-xs" onclick="advancedApp.deleteCron('${job.id}')" title="Delete this scheduled job">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:16px;">${cPanelApp.escapeHtml(err.message)}</td></tr>`;
      }
      cPanelApp.showToast(`Cron Jobs: ${err.message}`, 'error');
    }
  },

  async handleAddCron(e) {
    if (e) e.preventDefault();
    const min = document.getElementById('cron-min').value.trim();
    const hour = document.getElementById('cron-hour').value.trim();
    const day = document.getElementById('cron-day').value.trim();
    const month = document.getElementById('cron-month').value.trim();
    const weekday = document.getElementById('cron-weekday').value.trim();
    const command = document.getElementById('cron-command').value.trim();
    const description = document.getElementById('cron-desc').value.trim();
    const btn = document.getElementById('btn-submit-cron');

    if (!command) {
      cPanelApp.showToast('Please enter a command to execute.', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';
    }

    try {
      const res = await cPanelApp.api('/api/advanced/cron', {
        method: 'POST',
        body: { minute: min, hour, day, month, weekday, command, description }
      });
      cPanelApp.showToast(res.message || 'Cron job added!', 'success');
      document.getElementById('cron-command').value = '';
      document.getElementById('cron-desc').value = '';
      this.loadCronJobs();
    } catch (err) {
      cPanelApp.showToast(`Failed to schedule cron: ${err.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Add New Cron Job';
      }
    }
  },

  async runCronNow(id) {
    const outBox = document.getElementById('cron-output-box');
    const outContent = document.getElementById('cron-output-content');
    if (outBox) outBox.style.display = 'block';
    if (outContent) outContent.innerHTML = '<span style="color:#38bdf8;"><i class="fa-solid fa-spinner fa-spin"></i> Executing cron command in public_html...</span>';

    try {
      cPanelApp.showToast('Executing cron task...', 'info');
      const data = await cPanelApp.api(`/api/advanced/cron/${id}/run`, { method: 'POST' });
      const r = data.result;

      let formatted = `Command: ${r.command}\nDuration: ${r.durationMs}ms\nExit Code: ${r.exitCode}\n\n`;
      if (r.stdout) formatted += `[STDOUT]\n${r.stdout}\n\n`;
      if (r.stderr) formatted += `[STDERR]\n${r.stderr}\n`;

      if (outContent) outContent.textContent = formatted.trim();
      cPanelApp.showToast(`Execution finished with exit code ${r.exitCode} (${r.durationMs}ms)`, r.success ? 'success' : 'warning');
      this.loadCronJobs();
    } catch (err) {
      if (outContent) outContent.textContent = `Error executing task: ${err.message}`;
      cPanelApp.showToast(`Execution failed: ${err.message}`, 'error');
    }
  },

  async deleteCron(id) {
    if (!confirm('Are you sure you want to delete this scheduled cron job?')) return;

    try {
      const res = await cPanelApp.api(`/api/advanced/cron/${id}`, { method: 'DELETE' });
      cPanelApp.showToast(res.message || 'Cron job deleted.', 'success');
      this.loadCronJobs();
    } catch (err) {
      cPanelApp.showToast(`Failed to delete cron: ${err.message}`, 'error');
    }
  },

  // =========================================================================
  // 2. Error Pages Manager
  // =========================================================================
  openErrorPages() {
    cPanelApp.openModal('modal-error-pages');
    this.selectErrorCode('400');
  },

  async selectErrorCode(code) {
    this.currentErrorCode = code;

    // Update active tab buttons
    ['400', '401', '403', '404', '500'].forEach(c => {
      const btn = document.getElementById(`btn-err-${c}`);
      if (btn) {
        if (c === code) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });

    const fileEl = document.getElementById('err-current-file');
    const linkEl = document.getElementById('err-preview-link');
    const textarea = document.getElementById('err-content-textarea');

    if (fileEl) fileEl.textContent = `${code}.html`;
    if (linkEl) linkEl.href = `http://localhost/${code}.html`;
    if (textarea) textarea.value = 'Loading template...';

    try {
      const data = await cPanelApp.api(`/api/advanced/error-pages/${code}`);
      if (textarea) textarea.value = data.content || '';
    } catch (err) {
      cPanelApp.showToast(`Failed to load error template: ${err.message}`, 'error');
    }
  },

  insertTag(tag) {
    const textarea = document.getElementById('err-content-textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;

    textarea.value = val.substring(0, start) + tag + val.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + tag.length;
  },

  async saveCurrentErrorPage() {
    const code = this.currentErrorCode;
    const textarea = document.getElementById('err-content-textarea');
    const content = textarea ? textarea.value : '';
    const btn = document.getElementById('btn-save-error-page');

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {
      const res = await cPanelApp.api(`/api/advanced/error-pages/${code}`, {
        method: 'POST',
        body: { content, enabled: true }
      });
      cPanelApp.showToast(res.message || `Custom ${code}.html saved and active in .htaccess`, 'success');
    } catch (err) {
      cPanelApp.showToast(`Failed to save error page: ${err.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Error Page';
      }
    }
  },

  // =========================================================================
  // 3. Track DNS (Lookup, Ping, Traceroute, Hosts)
  // =========================================================================
  openTrackDNS() {
    cPanelApp.openModal('modal-track-dns');
    this.switchDnsTab('lookup');
  },

  switchDnsTab(tab) {
    const viewLookup = document.getElementById('dns-tab-lookup-view');
    const viewPing = document.getElementById('dns-tab-ping-view');
    const viewHosts = document.getElementById('dns-tab-hosts-view');

    const btnLookup = document.getElementById('btn-dns-tab-lookup');
    const btnPing = document.getElementById('btn-dns-tab-ping');
    const btnHosts = document.getElementById('btn-dns-tab-hosts');

    if (viewLookup) viewLookup.style.display = tab === 'lookup' ? 'block' : 'none';
    if (viewPing) viewPing.style.display = tab === 'ping' ? 'block' : 'none';
    if (viewHosts) viewHosts.style.display = tab === 'hosts' ? 'block' : 'none';

    if (btnLookup) btnLookup.classList.toggle('active', tab === 'lookup');
    if (btnPing) btnPing.classList.toggle('active', tab === 'ping');
    if (btnHosts) btnHosts.classList.toggle('active', tab === 'hosts');

    if (tab === 'hosts') {
      this.loadHostsFile();
    }
  },

  async handleDnsLookup(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('dns-lookup-input');
    const tbody = document.getElementById('dns-lookup-tbody');
    const domain = (input ? input.value : '').trim();

    if (!domain) {
      cPanelApp.showToast('Please enter a domain or host name.', 'error');
      return;
    }

    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:16px;"><i class="fa-solid fa-spinner fa-spin"></i> Performing DNS record resolution...</td></tr>';
    }

    try {
      const data = await cPanelApp.api('/api/advanced/dns/lookup', {
        method: 'POST',
        body: { domain }
      });

      const records = (data.lookup && data.lookup.records) || [];
      if (!tbody) return;

      if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#64748b; padding:16px;">No records found for "${cPanelApp.escapeHtml(domain)}".</td></tr>`;
        return;
      }

      tbody.innerHTML = records.map(r => {
        let typeBadge = '<span class="badge badge-primary">A</span>';
        if (r.type === 'AAAA') typeBadge = '<span class="badge badge-success">AAAA</span>';
        else if (r.type === 'MX') typeBadge = '<span class="badge badge-warning">MX</span>';
        else if (r.type === 'TXT') typeBadge = '<span class="badge badge-secondary">TXT</span>';
        else if (r.type === 'CNAME') typeBadge = '<span class="badge badge-info">CNAME</span>';

        return `
          <tr>
            <td>${typeBadge}</td>
            <td><code style="font-size:12px; color:#1e293b; font-weight:600;">${cPanelApp.escapeHtml(r.value)}</code></td>
            <td style="font-size:12px; color:#64748b;">${r.ttl}s</td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#ef4444; padding:16px;">${cPanelApp.escapeHtml(err.message)}</td></tr>`;
      }
      cPanelApp.showToast(`Lookup failed: ${err.message}`, 'error');
    }
  },

  async handleRunPing() {
    const input = document.getElementById('dns-ping-host');
    const terminal = document.getElementById('dns-diag-terminal');
    const host = (input ? input.value : '127.0.0.1').trim();

    if (terminal) {
      terminal.innerHTML = `<span style="color:#38bdf8;"><i class="fa-solid fa-spinner fa-spin"></i> Pinging ${cPanelApp.escapeHtml(host)} (4 packets)...</span>\n`;
    }

    try {
      const data = await cPanelApp.api('/api/advanced/dns/ping', {
        method: 'POST',
        body: { host }
      });
      const p = data.ping;
      if (terminal) {
        terminal.innerHTML = `<span style="color:#4ade80;">$ ${cPanelApp.escapeHtml(p.command)}</span>\n\n${cPanelApp.escapeHtml(p.rawOutput)}\n\n<span style="color:#38bdf8;">Packet Loss: ${p.packetLoss} | Average Latency: ${p.avgLatency}</span>`;
      }
    } catch (err) {
      if (terminal) terminal.textContent = `Ping failed: ${err.message}`;
    }
  },

  async handleRunTraceroute() {
    const input = document.getElementById('dns-ping-host');
    const terminal = document.getElementById('dns-diag-terminal');
    const host = (input ? input.value : '127.0.0.1').trim();

    if (terminal) {
      terminal.innerHTML = `<span style="color:#38bdf8;"><i class="fa-solid fa-spinner fa-spin"></i> Tracing route to ${cPanelApp.escapeHtml(host)} (Max 10 hops)...</span>\n`;
    }

    try {
      const data = await cPanelApp.api('/api/advanced/dns/traceroute', {
        method: 'POST',
        body: { host }
      });
      const t = data.trace;
      if (terminal) {
        terminal.innerHTML = `<span style="color:#4ade80;">$ ${cPanelApp.escapeHtml(t.command)}</span>\n\n${cPanelApp.escapeHtml(t.rawOutput)}`;
      }
    } catch (err) {
      if (terminal) terminal.textContent = `Traceroute failed: ${err.message}`;
    }
  },

  async loadHostsFile() {
    const tbody = document.getElementById('dns-hosts-tbody');
    const rawTextarea = document.getElementById('dns-hosts-raw');

    try {
      const data = await cPanelApp.api('/api/advanced/dns/hosts');
      const h = data.hosts || {};

      if (rawTextarea) rawTextarea.value = h.rawContent || '';
      if (!tbody) return;

      const entries = h.entries || [];
      if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#64748b; padding:12px;">No active domain mappings detected.</td></tr>';
        return;
      }

      tbody.innerHTML = entries.map(e => `
        <tr>
          <td><code style="font-weight:700; color:#0284c7;">${cPanelApp.escapeHtml(e.ip)}</code></td>
          <td><span style="color:#1e293b; font-weight:600;">${cPanelApp.escapeHtml(e.domains.join(', '))}</span></td>
        </tr>
      `).join('');

    } catch (err) {
      cPanelApp.showToast(`Failed to read hosts file: ${err.message}`, 'error');
    }
  }
};

window.advancedApp = advancedApp;
