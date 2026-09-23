// ==========================================================================
// cPanel Domains & Virtual Hosts Manager
// Handles Domains, Addon Domains, Subdomains, Redirects, and Zone Editor
// ==========================================================================

const domainsManager = {
  activeZoneFilter: 'all',
  cachedHostsGuidance: null,

  init() {
    this.setupListeners();
  },

  // Helper to render DNS Resolution Badge
  getDnsBadge(domain, hostsMap) {
    if (domain === 'localhost') {
      return '<span class="service-badge" style="background:#eff6ff; color:#2563eb; border-color:#bfdbfe;"><i class="fa-solid fa-circle-check"></i> System Default</span>';
    }
    const isMapped = !!(hostsMap && hostsMap[domain.toLowerCase()]);
    if (isMapped) {
      return '<span class="service-badge" style="background:#ecfdf5; color:#059669; border-color:#a7f3d0;" title="Mapped to 127.0.0.1 in Windows hosts file"><i class="fa-solid fa-circle-check"></i> Resolving Local</span>';
    }
    return '<span class="service-badge" style="background:#fffbeb; color:#d97706; border-color:#fde68a;" title="Hosts entry needed for local browser resolution"><i class="fa-solid fa-triangle-exclamation"></i> hosts Needed</span>';
  },

  // --------------------------------------------------------------------------
  // 1. Central Domains Dashboard
  // --------------------------------------------------------------------------
  async open() {
    cPanelApp.openModal('modal-domains');
    await this.loadDomains();
    await this.loadHostsGuidance();
  },

  async loadDomains() {
    const tbody = document.getElementById('domains-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading domains...</td></tr>';

    try {
      const data = await cPanelApp.api('/api/domains');
      if (!data.domains || data.domains.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No domains configured.</td></tr>';
        return;
      }

      if (data.hosts) {
        this.cachedHostsGuidance = data.hosts;
      }

      const hostsMap = {};
      if (this.cachedHostsGuidance && this.cachedHostsGuidance.domains) {
        this.cachedHostsGuidance.domains.forEach(h => {
          hostsMap[h.domain.toLowerCase()] = h.mappedInHosts;
        });
      }

      tbody.innerHTML = data.domains.map(d => `
        <tr>
          <td>
            <strong>${d.domain}</strong>
            ${d.type === 'primary' ? '<span style="margin-left:6px; font-size:10px; padding:2px 6px; background:#eff6ff; color:#2563eb; border-radius:4px; font-weight:600;">Main Domain</span>' : ''}
          </td>
          <td><code>${d.documentRoot}</code></td>
          <td><span class="service-badge" style="text-transform:capitalize;">${d.type}</span></td>
          <td>${this.getDnsBadge(d.domain, hostsMap)}</td>
          <td>${d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'System'}</td>
          <td style="text-align:right;">
            <a href="http://${d.domain}" target="_blank" class="btn-secondary btn-sm" title="Visit Site">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Open
            </a>
            ${d.type !== 'primary' ? `
              <button class="btn-danger btn-sm" onclick="domainsManager.removeDomain('${d.id}', '${d.domain}')" title="Delete Domain">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : '<span style="color:#94a3b8; font-size:11px; margin-left:8px;">Locked</span>'}
          </td>
        </tr>
      `).join('');

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
  },

  async addDomain(e) {
    e.preventDefault();
    const domain = document.getElementById('new-domain-name').value.trim();
    const documentRoot = document.getElementById('new-domain-root').value.trim();
    const type = document.getElementById('new-domain-type').value;

    if (!domain) return;

    try {
      await cPanelApp.api('/api/domains', {
        method: 'POST',
        body: { domain, documentRoot, type }
      });
      cPanelApp.showToast(`Domain "${domain}" added successfully! Apache vhosts updated.`, 'success');
      document.getElementById('new-domain-name').value = '';
      document.getElementById('new-domain-root').value = '';
      await this.loadHostsGuidance();
      await this.loadDomains();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  async removeDomain(id, name) {
    if (!confirm(`Are you sure you want to remove domain "${name}"?\nThis removes the Apache VirtualHost and associated DNS records.`)) return;
    try {
      await cPanelApp.api(`/api/domains/${id}`, { method: 'DELETE' });
      cPanelApp.showToast(`Domain "${name}" removed. Apache reloaded.`, 'info');
      await this.loadHostsGuidance();
      await this.loadDomains();
      const addonModal = document.getElementById('modal-addon-domains');
      if (addonModal && addonModal.classList.contains('active')) {
        await this.loadAddonDomains();
      }
      const subModal = document.getElementById('modal-subdomains');
      if (subModal && subModal.classList.contains('active')) {
        await this.loadSubdomains();
      }
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // --------------------------------------------------------------------------
  // 2. Addon Domains
  // --------------------------------------------------------------------------
  async openAddonDomains() {
    cPanelApp.openModal('modal-addon-domains');
    await this.loadHostsGuidance();
    await this.loadAddonDomains();
  },

  onAddonDomainInput(val) {
    const clean = val.trim().toLowerCase();
    const subInput = document.getElementById('addon-domain-subdomain');
    const rootInput = document.getElementById('addon-domain-root');
    if (!clean) {
      if (subInput) subInput.value = '';
      if (rootInput) rootInput.value = '';
      return;
    }
    const prefix = clean.split('.')[0].replace(/[^a-z0-9_-]/g, '');
    if (subInput) subInput.value = prefix;
    if (rootInput) rootInput.value = `public_html/${prefix}`;
  },

  async loadAddonDomains() {
    const tbody = document.getElementById('addon-domains-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading addon domains...</td></tr>';

    try {
      const [domData, redirData] = await Promise.all([
        cPanelApp.api('/api/domains'),
        cPanelApp.api('/api/domains/redirects').catch(() => ({ redirects: [] }))
      ]);

      const addons = (domData.domains || []).filter(d => d.type === 'addon');
      const redirects = redirData.redirects || [];

      if (addons.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No addon domains configured yet. Create one above!</td></tr>';
        return;
      }

      const hostsMap = {};
      if (this.cachedHostsGuidance && this.cachedHostsGuidance.domains) {
        this.cachedHostsGuidance.domains.forEach(h => {
          hostsMap[h.domain.toLowerCase()] = h.mappedInHosts;
        });
      }

      tbody.innerHTML = addons.map(d => {
        const shortSub = d.domain.split('.')[0];
        const redir = redirects.find(r => r.domain === d.domain);
        const redirText = redir ? `<a href="${redir.targetUrl}" target="_blank" style="color:#0284c7; font-size:12px;">${redir.targetUrl}</a>` : '<span style="color:#64748b; font-size:12px;">not redirected</span>';

        return `
          <tr>
            <td><strong>${d.domain}</strong></td>
            <td><code>${d.documentRoot}</code></td>
            <td><code>${shortSub}</code></td>
            <td>${this.getDnsBadge(d.domain, hostsMap)}</td>
            <td>${redirText}</td>
            <td style="text-align:right;">
              <a href="http://${d.domain}" target="_blank" class="btn-secondary btn-sm" title="Visit Addon Site">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Open
              </a>
              <button class="btn-danger btn-sm" onclick="domainsManager.removeDomain('${d.id}', '${d.domain}')" title="Remove Addon Domain">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
  },

  async addAddonDomain(e) {
    e.preventDefault();
    const domain = document.getElementById('addon-domain-name').value.trim();
    const documentRoot = document.getElementById('addon-domain-root').value.trim();

    if (!domain) return;

    try {
      await cPanelApp.api('/api/domains', {
        method: 'POST',
        body: { domain, documentRoot, type: 'addon' }
      });
      cPanelApp.showToast(`Addon domain "${domain}" created successfully!`, 'success');
      document.getElementById('addon-domain-name').value = '';
      document.getElementById('addon-domain-subdomain').value = '';
      document.getElementById('addon-domain-root').value = '';
      await this.loadHostsGuidance();
      await this.loadAddonDomains();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // --------------------------------------------------------------------------
  // 3. Subdomains
  // --------------------------------------------------------------------------
  async openSubdomains() {
    cPanelApp.openModal('modal-subdomains');
    await this.populateSubdomainParentDropdown();
    await this.loadHostsGuidance();
    await this.loadSubdomains();
  },

  async populateSubdomainParentDropdown() {
    const sel = document.getElementById('subdomain-parent-domain');
    if (!sel) return;
    try {
      const data = await cPanelApp.api('/api/domains');
      const domains = data.domains || [];
      sel.innerHTML = domains.map(d => `<option value="${d.domain}">${d.domain}</option>`).join('');
      this.updateSubdomainRoot();
    } catch (e) {
      sel.innerHTML = '<option value="localhost">localhost</option>';
    }
  },

  onSubdomainInput(val) {
    this.updateSubdomainRoot();
  },

  updateSubdomainRoot() {
    const prefix = (document.getElementById('subdomain-prefix').value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const rootInput = document.getElementById('subdomain-root');
    if (rootInput) {
      rootInput.value = prefix ? `public_html/${prefix}` : '';
    }
  },

  async loadSubdomains() {
    const tbody = document.getElementById('subdomains-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading subdomains...</td></tr>';

    try {
      const data = await cPanelApp.api('/api/domains');
      const subs = (data.domains || []).filter(d => d.type === 'subdomain');

      if (subs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No subdomains configured yet. Create one above!</td></tr>';
        return;
      }

      const hostsMap = {};
      if (this.cachedHostsGuidance && this.cachedHostsGuidance.domains) {
        this.cachedHostsGuidance.domains.forEach(h => {
          hostsMap[h.domain.toLowerCase()] = h.mappedInHosts;
        });
      }

      tbody.innerHTML = subs.map(d => `
        <tr>
          <td><strong>${d.domain}</strong></td>
          <td><code>${d.documentRoot}</code></td>
          <td>${this.getDnsBadge(d.domain, hostsMap)}</td>
          <td style="text-align:right;">
            <a href="http://${d.domain}" target="_blank" class="btn-secondary btn-sm" title="Visit Subdomain">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Open
            </a>
            <button class="btn-danger btn-sm" onclick="domainsManager.removeDomain('${d.id}', '${d.domain}')" title="Remove Subdomain">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
  },

  async addSubdomain(e) {
    e.preventDefault();
    const prefix = document.getElementById('subdomain-prefix').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const parentDomain = document.getElementById('subdomain-parent-domain').value.trim();
    const documentRoot = document.getElementById('subdomain-root').value.trim();

    if (!prefix || !parentDomain) return;
    const fullDomain = `${prefix}.${parentDomain}`;

    try {
      await cPanelApp.api('/api/domains', {
        method: 'POST',
        body: { domain: fullDomain, documentRoot, type: 'subdomain' }
      });
      cPanelApp.showToast(`Subdomain "${fullDomain}" created! Apache vhosts updated.`, 'success');
      document.getElementById('subdomain-prefix').value = '';
      document.getElementById('subdomain-root').value = '';
      await this.loadHostsGuidance();
      await this.loadSubdomains();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // --------------------------------------------------------------------------
  // 4. Redirects
  // --------------------------------------------------------------------------
  async openRedirects() {
    cPanelApp.openModal('modal-redirects');
    await this.populateRedirectDomainDropdown();
    await this.loadRedirects();
  },

  async populateRedirectDomainDropdown() {
    const sel = document.getElementById('redirect-domain');
    if (!sel) return;
    try {
      const data = await cPanelApp.api('/api/domains');
      const domains = data.domains || [];
      sel.innerHTML = `
        <option value="all">** All Public Domains **</option>
        ${domains.map(d => `<option value="${d.domain}">${d.domain}</option>`).join('')}
      `;
    } catch (e) {
      sel.innerHTML = '<option value="all">** All Public Domains **</option><option value="localhost">localhost</option>';
    }
  },

  async loadRedirects() {
    const tbody = document.getElementById('redirects-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading redirects...</td></tr>';

    try {
      const data = await cPanelApp.api('/api/domains/redirects');
      const list = data.redirects || [];

      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No active redirects found.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(r => `
        <tr>
          <td><strong>${r.domain === 'all' ? '*' : r.domain}</strong><code>${r.sourcePath}</code></td>
          <td><a href="${r.targetUrl}" target="_blank" style="color:#0284c7; word-break:break-all;">${r.targetUrl}</a></td>
          <td>
            <span class="service-badge" style="${r.type === '301' ? 'background:#eff6ff; color:#2563eb; border-color:#bfdbfe;' : 'background:#fef3c7; color:#d97706; border-color:#fde68a;'}">
              ${r.type} ${r.type === '301' ? 'Permanent' : 'Temporary'}
            </span>
          </td>
          <td>${r.matchWww === 'only' ? 'Only www.' : r.matchWww === 'none' ? 'No www.' : 'With or without www.'}</td>
          <td>${r.wildcard ? '<i class="fa-solid fa-check text-success"></i>' : '<span style="color:#94a3b8;">-</span>'}</td>
          <td style="text-align:right;">
            <button class="btn-danger btn-sm" onclick="domainsManager.removeRedirect('${r.id}')" title="Delete Redirect">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
  },

  async addRedirect(e) {
    e.preventDefault();
    const type = document.getElementById('redirect-type').value;
    const domain = document.getElementById('redirect-domain').value;
    let sourcePath = document.getElementById('redirect-source-path').value.trim();
    const targetUrl = document.getElementById('redirect-target-url').value.trim();
    const matchWww = document.getElementById('redirect-match-www').value;
    const wildcard = document.getElementById('redirect-wildcard').checked;

    if (!targetUrl) return;
    if (!sourcePath.startsWith('/')) sourcePath = '/' + sourcePath;

    try {
      await cPanelApp.api('/api/domains/redirects', {
        method: 'POST',
        body: { type, domain, sourcePath, targetUrl, matchWww, wildcard }
      });
      cPanelApp.showToast(`Redirect added and synchronized to .htaccess!`, 'success');
      document.getElementById('redirect-source-path').value = '';
      document.getElementById('redirect-target-url').value = '';
      await this.loadRedirects();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  async removeRedirect(id) {
    if (!confirm('Are you sure you want to delete this redirect? It will be removed from .htaccess.')) return;
    try {
      await cPanelApp.api(`/api/domains/redirects/${id}`, { method: 'DELETE' });
      cPanelApp.showToast('Redirect removed from .htaccess.', 'info');
      await this.loadRedirects();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // --------------------------------------------------------------------------
  // 5. Zone Editor (DNS)
  // --------------------------------------------------------------------------
  async openZoneEditor() {
    cPanelApp.openModal('modal-zone-editor');
    await this.populateZoneDomainFilter();
    await this.loadHostsGuidance();
    await this.loadZoneRecords();
  },

  async populateZoneDomainFilter() {
    const sel = document.getElementById('zone-filter-domain');
    if (!sel) return;
    try {
      const data = await cPanelApp.api('/api/domains');
      const domains = data.domains || [];
      const cur = this.activeZoneFilter;
      sel.innerHTML = `
        <option value="all" ${cur === 'all' ? 'selected' : ''}>** All Domains **</option>
        ${domains.map(d => `<option value="${d.domain}" ${cur === d.domain ? 'selected' : ''}>${d.domain}</option>`).join('')}
      `;
    } catch (e) {
      sel.innerHTML = '<option value="all">** All Domains **</option><option value="localhost">localhost</option>';
    }
  },

  filterZoneDomain(domain) {
    this.activeZoneFilter = domain;
    this.loadZoneRecords();
  },

  toggleAddRecordForm(type = 'A') {
    const panel = document.getElementById('zone-add-record-panel');
    if (!panel) return;
    panel.style.display = 'block';

    const typeSel = document.getElementById('zone-record-type');
    if (typeSel) typeSel.value = type;

    const curDomain = this.activeZoneFilter !== 'all' ? this.activeZoneFilter : 'localhost';
    const nameInput = document.getElementById('zone-record-name');
    if (nameInput) {
      if (type === 'CNAME') {
        nameInput.value = `www.${curDomain}.`;
      } else {
        nameInput.value = `${curDomain}.`;
      }
    }
    this.onRecordTypeChange(type);
    panel.scrollIntoView({ behavior: 'smooth' });
  },

  hideAddRecordForm() {
    const panel = document.getElementById('zone-add-record-panel');
    if (panel) panel.style.display = 'none';
  },

  onRecordTypeChange(type) {
    const valLabel = document.getElementById('zone-record-value-label');
    const valInput = document.getElementById('zone-record-value');
    if (!valLabel || !valInput) return;

    if (type === 'A') {
      valLabel.innerText = 'IPv4 Address';
      valInput.placeholder = '127.0.0.1';
      if (!valInput.value || valInput.value.includes('.')) valInput.value = '127.0.0.1';
    } else if (type === 'AAAA') {
      valLabel.innerText = 'IPv6 Address';
      valInput.placeholder = '::1';
      valInput.value = '::1';
    } else if (type === 'CNAME') {
      valLabel.innerText = 'Target FQDN';
      valInput.placeholder = 'localhost.';
      valInput.value = `${this.activeZoneFilter !== 'all' ? this.activeZoneFilter : 'localhost'}.`;
    } else if (type === 'TXT') {
      valLabel.innerText = 'TXT Data';
      valInput.placeholder = 'v=spf1 +a +mx ~all';
      valInput.value = '';
    } else if (type === 'MX') {
      valLabel.innerText = 'Destination Mail Host';
      valInput.placeholder = 'mail.localhost.';
      valInput.value = '';
    }
  },

  async loadZoneRecords() {
    const tbody = document.getElementById('zone-records-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading DNS records...</td></tr>';

    try {
      const url = this.activeZoneFilter && this.activeZoneFilter !== 'all'
        ? `/api/domains/zone-records?domain=${encodeURIComponent(this.activeZoneFilter)}`
        : '/api/domains/zone-records';

      const data = await cPanelApp.api(url);
      const records = data.records || [];

      if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No DNS records found for this selection.</td></tr>';
        return;
      }

      tbody.innerHTML = records.map(r => `
        <tr>
          <td><strong>${r.name}</strong></td>
          <td>${r.ttl || 14400}</td>
          <td>${r.class || 'IN'}</td>
          <td>
            <span class="service-badge" style="font-weight:700; background:#f1f5f9; color:#0f172a; border-color:#cbd5e1;">
              ${r.type}
            </span>
          </td>
          <td><code style="word-break:break-all;">${r.record}</code></td>
          <td style="text-align:right;">
            <button class="btn-danger btn-sm" onclick="domainsManager.removeZoneRecord('${r.id}')" title="Delete Record">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
  },

  async addZoneRecord(e) {
    e.preventDefault();
    const name = document.getElementById('zone-record-name').value.trim();
    const ttl = parseInt(document.getElementById('zone-record-ttl').value || '14400', 10);
    const type = document.getElementById('zone-record-type').value;
    const record = document.getElementById('zone-record-value').value.trim();
    const domain = this.activeZoneFilter !== 'all' ? this.activeZoneFilter : 'localhost';

    if (!name || !record) return;

    try {
      await cPanelApp.api('/api/domains/zone-records', {
        method: 'POST',
        body: { domain, name, ttl, type, record }
      });
      cPanelApp.showToast(`DNS record "${name} ${type}" created!`, 'success');
      this.hideAddRecordForm();
      await this.loadZoneRecords();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  async removeZoneRecord(id) {
    if (!confirm('Are you sure you want to delete this DNS record?')) return;
    try {
      await cPanelApp.api(`/api/domains/zone-records/${id}`, { method: 'DELETE' });
      cPanelApp.showToast('DNS record deleted.', 'info');
      await this.loadZoneRecords();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // --------------------------------------------------------------------------
  // Hosts File Guidance Synchronization
  // --------------------------------------------------------------------------
  async loadHostsGuidance() {
    try {
      const data = await cPanelApp.api('/api/domains/hosts');
      this.cachedHostsGuidance = data;

      const isAllOk = data.allMapped;

      // Update in main domains modal
      const box1 = document.getElementById('hosts-file-guidance');
      if (box1) {
        if (!data.entries || data.entries.length <= 1) {
          box1.innerHTML = '<div style="margin-top:14px; font-size:12px; color:#10b981;"><i class="fa-solid fa-circle-check"></i> Primary localhost mapping is active in Windows.</div>';
        } else {
          box1.innerHTML = `
            <div style="background-color:#ffffff; border:1px solid ${isAllOk ? '#a7f3d0' : '#fde68a'}; border-radius:8px; padding:16px; font-size:12.5px; margin-top:20px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong style="color:#0f172a; font-size:13px;">
                    <i class="fa-brands fa-windows text-primary"></i> Windows Localhost DNS Mapping
                  </strong>
                  ${isAllOk
                    ? '<span class="service-badge" style="background:#ecfdf5; color:#059669; border-color:#a7f3d0;"><i class="fa-solid fa-circle-check"></i> All Domains Mapped</span>'
                    : '<span class="service-badge" style="background:#fffbeb; color:#d97706; border-color:#fde68a;"><i class="fa-solid fa-triangle-exclamation"></i> Action Recommended</span>'
                  }
                </div>
                <div style="display:flex; gap:8px;">
                  <button class="btn-primary btn-sm" onclick="domainsManager.syncHosts()" title="Auto-writes these entries to C:\\Windows\\System32\\drivers\\etc\\hosts">
                    <i class="fa-brands fa-windows"></i> Auto-Sync Hosts (UAC)
                  </button>
                  <button class="btn-secondary btn-sm" onclick="domainsManager.copyHostsGuidance()">
                    <i class="fa-solid fa-copy"></i> Copy Entries
                  </button>
                </div>
              </div>
              <p style="margin-bottom:8px; color:#475569; font-size:12px;">
                For custom domains (like <code>mysite.local</code>) to open in your browser, Windows routes them through <code>${data.filePath}</code>:
              </p>
              <pre style="background:#0f172a; color:#38bdf8; padding:10px 14px; border-radius:6px; font-family:Consolas, monospace; font-size:12px; margin:0; overflow-x:auto;">${data.rawText}</pre>
            </div>
          `;
        }
      }

      // Update in addon domains modal
      const box2 = document.getElementById('addon-hosts-guidance');
      if (box2 && data.entries && data.entries.length > 1) {
        box2.innerHTML = `
          <div style="background-color:#ffffff; border:1px solid ${isAllOk ? '#a7f3d0' : '#fde68a'}; border-radius:8px; padding:16px; font-size:12.5px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <strong style="color:#0f172a;"><i class="fa-brands fa-windows text-primary"></i> Localhost Name Resolution</strong>
                ${isAllOk
                  ? '<span class="service-badge" style="background:#ecfdf5; color:#059669; border-color:#a7f3d0;"><i class="fa-solid fa-circle-check"></i> Resolving</span>'
                  : '<span class="service-badge" style="background:#fffbeb; color:#d97706; border-color:#fde68a;"><i class="fa-solid fa-triangle-exclamation"></i> Not Synced Yet</span>'
                }
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn-primary btn-sm" onclick="domainsManager.syncHosts()">
                  <i class="fa-brands fa-windows"></i> Auto-Sync Hosts
                </button>
                <button class="btn-secondary btn-sm" onclick="domainsManager.copyHostsGuidance()">
                  <i class="fa-solid fa-copy"></i> Copy Entries
                </button>
              </div>
            </div>
            <p style="color:#475569; margin-bottom:8px; font-size:12px;">Add to <code>${data.filePath}</code> so Windows routes your custom domain locally:</p>
            <pre style="background:#0f172a; color:#38bdf8; padding:10px 14px; border-radius:6px; font-family:Consolas, monospace; font-size:12px; margin:0; overflow-x:auto;">${data.rawText}</pre>
          </div>
        `;
      }

      // Update in Zone Editor pre
      const pre = document.getElementById('zone-hosts-pre');
      if (pre) {
        pre.textContent = data.rawText || '127.0.0.1  localhost';
      }
    } catch (e) {}
  },

  async syncHosts() {
    cPanelApp.showToast('Launching Windows hosts updater... If prompted by Windows, click "Yes".', 'info');
    try {
      const res = await cPanelApp.api('/api/domains/sync-hosts', { method: 'POST' });
      cPanelApp.showToast(res.message || 'Windows hosts update initiated.', 'success');
      setTimeout(async () => {
        await this.loadHostsGuidance();
        await this.loadDomains();
        const addonModal = document.getElementById('modal-addon-domains');
        if (addonModal && addonModal.classList.contains('active')) {
          await this.loadAddonDomains();
        }
        const subModal = document.getElementById('modal-subdomains');
        if (subModal && subModal.classList.contains('active')) {
          await this.loadSubdomains();
        }
      }, 3500);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  copyHostsGuidance() {
    if (!this.cachedHostsGuidance || !this.cachedHostsGuidance.rawText) {
      cPanelApp.showToast('No entries to copy', 'warning');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(this.cachedHostsGuidance.rawText).then(() => {
        cPanelApp.showToast('Windows hosts entries copied to clipboard!', 'success');
      });
    } else {
      cPanelApp.copyText(this.cachedHostsGuidance.rawText);
    }
  },

  // --------------------------------------------------------------------------
  // Setup Form Listeners
  // --------------------------------------------------------------------------
  setupListeners() {
    // 1. Domains form
    const formDomains = document.getElementById('form-add-domain');
    if (formDomains) formDomains.onsubmit = (e) => this.addDomain(e);

    // 2. Addon Domains form
    const formAddon = document.getElementById('form-add-addon-domain');
    if (formAddon) formAddon.onsubmit = (e) => this.addAddonDomain(e);

    // 3. Subdomains form
    const formSub = document.getElementById('form-add-subdomain');
    if (formSub) formSub.onsubmit = (e) => this.addSubdomain(e);

    // 4. Redirects form
    const formRedirect = document.getElementById('form-add-redirect');
    if (formRedirect) formRedirect.onsubmit = (e) => this.addRedirect(e);

    // 5. Zone records form
    const formZone = document.getElementById('form-add-zone-record');
    if (formZone) formZone.onsubmit = (e) => this.addZoneRecord(e);
  }
};

window.domainsManager = domainsManager;
document.addEventListener('DOMContentLoaded', () => domainsManager.init());
