/**
 * cPanel Security Suite: SSL/TLS Status & IP Blocker
 */
const securityApp = {
  // =========================================================================
  // SSL / TLS Status Manager
  // =========================================================================
  openSSL() {
    cPanelApp.openModal('modal-ssl');
    this.loadSSL();
  },

  async loadSSL() {
    const tbody = document.getElementById('ssl-domains-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Inspecting SSL certificates...</td></tr>';
    }

    try {
      const data = await cPanelApp.api('/api/security/ssl');
      const domains = data.domains || [];

      // Update counters
      const totalCount = domains.length;
      const activeCount = domains.filter(d => d.status === 'active').length;
      const unsecuredCount = domains.filter(d => d.status !== 'active').length;

      const elTotal = document.getElementById('ssl-stat-total');
      const elActive = document.getElementById('ssl-stat-active');
      const elUnsecured = document.getElementById('ssl-stat-unsecured');
      if (elTotal) elTotal.textContent = totalCount;
      if (elActive) elActive.textContent = activeCount;
      if (elUnsecured) elUnsecured.textContent = unsecuredCount;

      if (!tbody) return;

      if (domains.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b; padding:20px;">No domains configured. Add domains in Domains Manager.</td></tr>';
        return;
      }

      tbody.innerHTML = domains.map(d => {
        const isActive = d.status === 'active';
        const statusBadge = isActive
          ? '<span class="badge badge-success" style="font-size:11px;"><i class="fa-solid fa-circle-check"></i> Active</span>'
          : '<span class="badge badge-warning" style="font-size:11px;"><i class="fa-solid fa-triangle-exclamation"></i> Unsecured</span>';

        const typeBadge = `<span style="font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px; background:#e2e8f0; color:#475569; margin-left:6px; text-transform:uppercase;">${d.type || 'domain'}</span>`;

        let daysBadge = '-';
        if (isActive) {
          const color = d.daysLeft > 30 ? '#16a34a' : '#ea580c';
          daysBadge = `<span style="color:${color}; font-weight:600;">${d.daysLeft} days</span>`;
        }

        return `
          <tr>
            <td>
              <strong>${cPanelApp.escapeHtml(d.domain)}</strong>
              ${typeBadge}
            </td>
            <td>${statusBadge}</td>
            <td style="font-size:12px; color:#475569;">${cPanelApp.escapeHtml(d.issuer || 'None')}</td>
            <td style="font-size:12px; color:#475569;">${cPanelApp.escapeHtml(d.validTo || '-')}</td>
            <td style="font-size:12px;">${daysBadge}</td>
            <td><code style="font-size:11px; color:#64748b;">${cPanelApp.escapeHtml(d.fingerprint || 'N/A')}</code></td>
            <td style="text-align:right; white-space:nowrap;">
              ${isActive ? `
                <button class="btn-secondary btn-xs" onclick="securityApp.viewCert('${d.domain}')" title="View Certificate Details">
                  <i class="fa-solid fa-eye"></i> View Cert
                </button>
              ` : ''}
              <button class="btn-primary btn-xs" onclick="securityApp.runAutoSSL('${d.domain}')" title="Generate or Renew SSL via AutoSSL">
                <i class="fa-solid fa-wand-magic-sparkles"></i> AutoSSL
              </button>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:20px;"><i class="fa-solid fa-triangle-exclamation"></i> ${cPanelApp.escapeHtml(err.message)}</td></tr>`;
      }
      cPanelApp.showToast(`SSL Status: ${err.message}`, 'error');
    }
  },

  async runAutoSSL(domain) {
    try {
      cPanelApp.showToast(`Running AutoSSL for ${domain}...`, 'info');
      const res = await cPanelApp.api('/api/security/ssl/autossl', {
        method: 'POST',
        body: { domain }
      });
      cPanelApp.showToast(res.result.message || `AutoSSL certificate issued for ${domain}`, 'success');
      this.loadSSL();
    } catch (err) {
      cPanelApp.showToast(`AutoSSL failed: ${err.message}`, 'error');
    }
  },

  async runAutoSSLAll() {
    const btn = document.getElementById('btn-run-autossl-all');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running AutoSSL...';
    }

    try {
      cPanelApp.showToast('Running AutoSSL across all domains...', 'info');
      const res = await cPanelApp.api('/api/security/ssl/autossl-all', { method: 'POST' });
      const count = (res.results || []).length;
      cPanelApp.showToast(`AutoSSL completed for ${count} domains.`, 'success');
      this.loadSSL();
    } catch (err) {
      cPanelApp.showToast(`AutoSSL All failed: ${err.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Run AutoSSL';
      }
    }
  },

  async viewCert(domain) {
    try {
      const data = await cPanelApp.api(`/api/security/ssl/cert?domain=${encodeURIComponent(domain)}`);
      const cert = data.certificate;

      const box = document.getElementById('ssl-cert-detail-box');
      if (!box) return;

      document.getElementById('ssl-cert-domain-title').textContent = cert.domain;
      document.getElementById('ssl-detail-subject').textContent = cert.subject;
      document.getElementById('ssl-detail-issuer').textContent = cert.issuer;
      document.getElementById('ssl-detail-range').textContent = `${cert.validFrom.split('T')[0]} to ${cert.validTo.split('T')[0]}`;
      document.getElementById('ssl-detail-specs').textContent = cert.keyAlgorithm;
      document.getElementById('ssl-detail-fingerprint').textContent = cert.fingerprint256;
      document.getElementById('ssl-detail-pem').value = cert.certificatePem;

      box.style.display = 'block';
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      cPanelApp.showToast(`Could not load certificate: ${err.message}`, 'error');
    }
  },

  // =========================================================================
  // IP Blocker Manager
  // =========================================================================
  openIPBlocker() {
    cPanelApp.openModal('modal-ip-blocker');
    this.loadBlockedIPs();
  },

  async loadBlockedIPs() {
    const tbody = document.getElementById('ip-blocker-tbody');
    const countEl = document.getElementById('ip-blocker-count');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading blocked IP list...</td></tr>';
    }

    try {
      const data = await cPanelApp.api('/api/security/ip-blocker');
      const list = data.blockedIps || [];

      if (countEl) countEl.textContent = list.length;
      if (!tbody) return;

      if (list.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align:center; color:#64748b; padding:24px;">
              <i class="fa-solid fa-shield-check" style="font-size:24px; color:#16a34a; margin-bottom:8px; display:block;"></i>
              No blocked IP addresses. All incoming localhost and network requests are currently permitted.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = list.map(item => {
        const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A';
        return `
          <tr>
            <td>
              <code style="font-weight:700; font-size:13px; color:#b91c1c;">${cPanelApp.escapeHtml(item.ip)}</code>
            </td>
            <td style="font-size:13px; color:#475569;">${cPanelApp.escapeHtml(item.comment || 'No comment provided')}</td>
            <td style="font-size:12px; color:#64748b;">${dateStr}</td>
            <td style="text-align:right;">
              <button class="btn-danger btn-xs" onclick="securityApp.removeBlockedIP('${item.id}', '${item.ip}')" title="Unblock this IP in .htaccess">
                <i class="fa-solid fa-trash"></i> Unblock
              </button>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#ef4444; padding:20px;"><i class="fa-solid fa-triangle-exclamation"></i> ${cPanelApp.escapeHtml(err.message)}</td></tr>`;
      }
      cPanelApp.showToast(`IP Blocker: ${err.message}`, 'error');
    }
  },

  async handleAddIP(e) {
    if (e) e.preventDefault();
    const inputIp = document.getElementById('input-block-ip');
    const inputComment = document.getElementById('input-block-comment');
    const btn = document.getElementById('btn-submit-block-ip');

    const ip = (inputIp ? inputIp.value : '').trim();
    const comment = (inputComment ? inputComment.value : '').trim();

    if (!ip) {
      cPanelApp.showToast('Please enter an IP address or CIDR range.', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Blocking...';
    }

    try {
      const res = await cPanelApp.api('/api/security/ip-blocker', {
        method: 'POST',
        body: { ip, comment }
      });
      cPanelApp.showToast(res.message || `Blocked ${ip} in .htaccess`, 'success');
      if (inputIp) inputIp.value = '';
      if (inputComment) inputComment.value = '';
      this.loadBlockedIPs();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Block IP';
      }
    }
  },

  async removeBlockedIP(id, ip) {
    if (!confirm(`Are you sure you want to unblock ${ip}? This will immediately remove the block rule from Apache .htaccess.`)) {
      return;
    }

    try {
      const res = await cPanelApp.api(`/api/security/ip-blocker/${id}`, { method: 'DELETE' });
      cPanelApp.showToast(res.message || `Unblocked ${ip}`, 'success');
      this.loadBlockedIPs();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  }
};

window.securityApp = securityApp;
