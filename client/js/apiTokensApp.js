/**
 * cPanel Manage API Tokens & AI Integration Controller
 */
const apiTokensApp = {
  currentTab: 'tokens',
  availableScopes: [
    { id: '*', label: 'Full Access (All Scopes)', desc: 'Administrative access to all cPanel modules' },
    { id: 'files', label: 'File Manager', desc: 'Read, write, create, delete, zip, unzip' },
    { id: 'mysql', label: 'MySQL Databases', desc: 'Create databases, manage users & privileges' },
    { id: 'domains', label: 'Domains & DNS', desc: 'Add domains, vhosts, redirects, DNS records' },
    { id: 'advanced', label: 'Cron & Advanced', desc: 'Schedule cron tasks, error pages, track DNS' },
    { id: 'security', label: 'Security & SSL', desc: 'Inspect/generate SSL certs, IP Blocker' },
    { id: 'software', label: 'Software & PHP', desc: 'PHP version, php.ini directives, extensions' },
    { id: 'metrics', label: 'Metrics & Logs', desc: 'Visitor stats, traffic bandwidth, error logs' },
    { id: 'backups', label: 'Backups', desc: 'Generate and restore full or partial archives' },
    { id: 'system', label: 'System & Services', desc: 'Server health, hardware stats, Apache/MySQL' },
    { id: 'terminal', label: 'Terminal / SSH', desc: 'Execute server shell commands' }
  ],

  endpointsCatalog: [
    { module: 'AI Gateway', method: 'POST', path: '/api/ai/execute', desc: 'Universal AI gateway to execute any tool with { tool, parameters }' },
    { module: 'AI Gateway', method: 'GET', path: '/api/ai/openapi.json', desc: 'Full OpenAPI 3.0.3 specification for ChatGPT Actions & Swagger' },
    { module: 'AI Gateway', method: 'GET', path: '/api/ai/tools', desc: 'Pre-formatted OpenAI and Claude tool calling definitions' },
    { module: 'AI Gateway', method: 'GET', path: '/api/ai/prompt', desc: 'Auto-configured AI system prompt for LLM agents' },
    { module: 'cPanel UAPI', method: 'ANY', path: '/api/uapi/:module/:function', desc: 'Authentic cPanel UAPI gateway (e.g. Mysql::create_database)' },
    { module: 'Tokens', method: 'GET', path: '/api/tokens', desc: 'List active personal API tokens' },
    { module: 'Tokens', method: 'POST', path: '/api/tokens', desc: 'Generate a new API token with custom scopes' },
    { module: 'Tokens', method: 'DELETE', path: '/api/tokens/:id', desc: 'Revoke and invalidate an API token' },
    { module: 'Files', method: 'GET', path: '/api/files?dir=/public_html', desc: 'List files and folders in directory' },
    { module: 'Files', method: 'GET', path: '/api/files/content?path=...', desc: 'Read file text content' },
    { module: 'Files', method: 'POST', path: '/api/files/save', desc: 'Save or update file content' },
    { module: 'Files', method: 'POST', path: '/api/files/create', desc: 'Create new empty file or directory' },
    { module: 'Files', method: 'POST', path: '/api/files/delete', desc: 'Delete file or directory' },
    { module: 'Files', method: 'POST', path: '/api/files/extract', desc: 'Extract ZIP archive' },
    { module: 'Files', method: 'POST', path: '/api/files/compress', desc: 'Compress files into ZIP archive' },
    { module: 'MySQL', method: 'GET', path: '/api/mysql/databases', desc: 'List all databases with size and table count' },
    { module: 'MySQL', method: 'POST', path: '/api/mysql/databases', desc: 'Create a new MySQL database' },
    { module: 'MySQL', method: 'DELETE', path: '/api/mysql/databases/:name', desc: 'Drop / delete a MySQL database' },
    { module: 'MySQL', method: 'GET', path: '/api/mysql/users', desc: 'List database user accounts' },
    { module: 'MySQL', method: 'POST', path: '/api/mysql/users', desc: 'Create new database user' },
    { module: 'MySQL', method: 'POST', path: '/api/mysql/privileges', desc: 'Set database privileges for user' },
    { module: 'Domains', method: 'GET', path: '/api/domains', desc: 'List all domains, addon domains, subdomains' },
    { module: 'Domains', method: 'POST', path: '/api/domains', desc: 'Add domain with automatic Apache vhosts & DNS' },
    { module: 'Domains', method: 'DELETE', path: '/api/domains/:id', desc: 'Remove domain and vhost' },
    { module: 'Domains', method: 'GET', path: '/api/domains/zone-records', desc: 'List DNS zone records (A, CNAME, MX, TXT)' },
    { module: 'Domains', method: 'POST', path: '/api/domains/zone-records', desc: 'Create DNS zone record' },
    { module: 'Advanced', method: 'GET', path: '/api/advanced/cron', desc: 'List all automated cron jobs' },
    { module: 'Advanced', method: 'POST', path: '/api/advanced/cron', desc: 'Create new scheduled cron job' },
    { module: 'Advanced', method: 'POST', path: '/api/advanced/cron/:id/run', desc: 'Run cron job immediately and capture stdout' },
    { module: 'Advanced', method: 'GET', path: '/api/advanced/error-pages', desc: 'List custom HTTP error pages (404, 500, etc.)' },
    { module: 'Advanced', method: 'POST', path: '/api/advanced/dns-lookup', desc: 'Resolve DNS records for any domain' },
    { module: 'Advanced', method: 'POST', path: '/api/advanced/ping', desc: 'Execute live ICMP ping test' },
    { module: 'Security', method: 'GET', path: '/api/security/ssl/status', desc: 'List SSL/TLS certificates for all domains' },
    { module: 'Security', method: 'POST', path: '/api/security/ssl/generate-self-signed', desc: 'Generate self-signed SSL certificate' },
    { module: 'Security', method: 'GET', path: '/api/security/ip-blocker', desc: 'List blocked IP addresses in .htaccess' },
    { module: 'Security', method: 'POST', path: '/api/security/ip-blocker', desc: 'Block IP address or subnet' },
    { module: 'Software', method: 'GET', path: '/api/software/multiphp', desc: 'MultiPHP Manager configuration and version' },
    { module: 'Software', method: 'GET', path: '/api/software/php-ini', desc: 'Read active php.ini directives' },
    { module: 'Software', method: 'POST', path: '/api/software/php-ini', desc: 'Update php.ini directives' },
    { module: 'Metrics', method: 'GET', path: '/api/metrics/summary', desc: 'Real-time bandwidth and resource usage' },
    { module: 'Metrics', method: 'GET', path: '/api/metrics/visitors', desc: 'Parsed visitor access log details' },
    { module: 'Metrics', method: 'GET', path: '/api/metrics/errors', desc: 'Apache and PHP error log stream' },
    { module: 'Backups', method: 'GET', path: '/api/backups', desc: 'List generated backup archives' },
    { module: 'Backups', method: 'POST', path: '/api/backups', desc: 'Create full or homedir backup' },
    { module: 'System', method: 'GET', path: '/api/xampp/status', desc: 'Apache and MySQL running status and ports' },
    { module: 'System', method: 'GET', path: '/api/xampp/system-info', desc: 'Hardware CPU, RAM, Disk usage stats' },
    { module: 'Terminal', method: 'POST', path: '/api/terminal/exec', desc: 'Execute shell command in hosting environment' }
  ],

  open() {
    cPanelApp.openModal('modal-api-tokens');
    this.switchTab('tokens');
    this.loadTokens();
    this.loadAiSpecs();
    this.renderCatalog();
  },

  switchTab(tab) {
    this.currentTab = tab;
    ['tokens', 'ai', 'explorer'].forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const view = document.getElementById(`view-${t}`);
      if (btn) {
        if (t === tab) {
          btn.style.background = '#0284c7';
          btn.style.color = '#fff';
        } else {
          btn.style.background = '#f1f5f9';
          btn.style.color = '#475569';
        }
      }
      if (view) {
        view.style.display = t === tab ? 'block' : 'none';
      }
    });
  },

  async loadTokens() {
    const tbody = document.getElementById('tokens-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Loading API tokens...</td></tr>';
    }

    try {
      const res = await cPanelApp.api('/api/tokens');
      const tokens = res.tokens || [];

      if (!tbody) return;

      if (tokens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#64748b;">No API tokens active. Click <strong>"Create API Token"</strong> to generate your first AI or automation key.</td></tr>';
        return;
      }

      tbody.innerHTML = tokens.map(t => {
        let scopesBadge = '<span class="badge badge-primary" style="font-size:10px;">Full Access (*)</span>';
        if (t.scopes && !t.scopes.includes('*')) {
          scopesBadge = t.scopes.map(s => `<span class="badge badge-secondary" style="font-size:10px; margin:1px;">${cPanelApp.escapeHtml(s)}</span>`).join(' ');
        }

        const createdStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'N/A';
        const expiresStr = t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : '<span style="color:#10b981; font-weight:600;">Never</span>';
        const lastUsedStr = t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : '<span style="color:#94a3b8;">Never</span>';

        return `
          <tr>
            <td style="font-weight:600; color:#1e293b; font-size:13px;">
              <i class="fa-solid fa-key" style="color:#0284c7; margin-right:6px;"></i> ${cPanelApp.escapeHtml(t.name)}
            </td>
            <td>
              <code style="font-weight:700; color:#0284c7; font-size:12px;">${cPanelApp.escapeHtml(t.tokenPrefix || 'cptok_...')}</code>
            </td>
            <td>${scopesBadge}</td>
            <td style="font-size:12px; color:#64748b;">${createdStr}</td>
            <td style="font-size:12px;">${expiresStr}</td>
            <td style="font-size:12px;">${lastUsedStr}</td>
            <td style="text-align:right;">
              <button class="btn-danger btn-sm" onclick="apiTokensApp.revokeToken('${t.id}', '${cPanelApp.escapeHtml(t.name)}')" title="Revoke this API Token">
                <i class="fa-solid fa-trash"></i> Revoke
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:20px;">Failed to load tokens: ${cPanelApp.escapeHtml(err.message)}</td></tr>`;
      }
    }
  },

  openCreateDrawer() {
    const card = document.getElementById('token-create-card');
    if (card) {
      card.style.display = 'block';
      document.getElementById('input-token-name').value = '';
      document.getElementById('input-token-name').focus();
      this.renderScopeCheckboxes();
    }
  },

  closeCreateDrawer() {
    const card = document.getElementById('token-create-card');
    if (card) card.style.display = 'none';
  },

  renderScopeCheckboxes() {
    const container = document.getElementById('token-scopes-grid');
    if (!container) return;

    container.innerHTML = this.availableScopes.map(s => `
      <label style="display:flex; align-items:flex-start; gap:8px; font-size:12px; cursor:pointer; margin:0; padding:4px;">
        <input type="checkbox" name="token-scope" value="${s.id}" ${s.id === '*' ? 'checked' : ''} onchange="apiTokensApp.handleScopeChange(this)" style="margin-top:2px;" />
        <div>
          <strong style="color:#1e293b; display:block;">${cPanelApp.escapeHtml(s.label)}</strong>
          <span style="font-size:10px; color:#64748b; line-height:1.2; display:block;">${cPanelApp.escapeHtml(s.desc)}</span>
        </div>
      </label>
    `).join('');
  },

  handleScopeChange(checkbox) {
    if (checkbox.value === '*' && checkbox.checked) {
      // Uncheck individual scopes if All is selected
      document.querySelectorAll('input[name="token-scope"]').forEach(cb => {
        if (cb.value !== '*') cb.checked = false;
      });
    } else if (checkbox.value !== '*' && checkbox.checked) {
      // Uncheck All if individual scope is clicked
      const star = document.querySelector('input[name="token-scope"][value="*"]');
      if (star) star.checked = false;
    }
  },

  toggleAllScopes(checked) {
    document.querySelectorAll('input[name="token-scope"]').forEach(cb => {
      if (cb.value === '*') {
        cb.checked = checked;
      } else {
        cb.checked = false;
      }
    });
  },

  async handleCreateToken() {
    const nameInput = document.getElementById('input-token-name');
    const expirySelect = document.getElementById('select-token-expiry');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
      cPanelApp.showToast('Please enter a name for the token', 'error');
      return;
    }

    const selectedScopes = [];
    document.querySelectorAll('input[name="token-scope"]:checked').forEach(cb => {
      selectedScopes.push(cb.value);
    });

    let expiresAt = null;
    const days = expirySelect ? parseInt(expirySelect.value, 10) : 0;
    if (days > 0) {
      const d = new Date();
      d.setDate(d.getDate() + days);
      expiresAt = d.toISOString();
    }

    try {
      const res = await cPanelApp.api('/api/tokens', {
        method: 'POST',
        body: {
          name,
          scopes: selectedScopes.length > 0 ? selectedScopes : ['*'],
          expiresAt
        }
      });

      if (res.success && res.rawToken) {
        this.closeCreateDrawer();
        this.showRevealedToken(res.rawToken);
        this.loadTokens();
        cPanelApp.showToast('API Token generated successfully!', 'success');
      }
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  showRevealedToken(rawToken) {
    const banner = document.getElementById('token-reveal-banner');
    const valInput = document.getElementById('revealed-token-value');
    if (banner && valInput) {
      banner.style.display = 'block';
      valInput.value = rawToken;
      valInput.select();
    }
  },

  copyRevealedToken() {
    const valInput = document.getElementById('revealed-token-value');
    if (valInput) {
      this.copyText(valInput.value, document.getElementById('btn-copy-token'), 'Copied Token!');
    }
  },

  async revokeToken(id, name) {
    if (!confirm(`Are you sure you want to revoke the token "${name}"? Any external AI or script using this key will immediately lose access.`)) {
      return;
    }

    try {
      await cPanelApp.api(`/api/tokens/${id}`, { method: 'DELETE' });
      cPanelApp.showToast(`Token "${name}" revoked`, 'success');
      this.loadTokens();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
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

  async loadAiSpecs() {
    const baseUrl = window.location.origin;
    const openApiUrl = `${baseUrl}/api/ai/openapi.json`;

    const urlElem = document.getElementById('openapi-url-text');
    if (urlElem) urlElem.innerText = openApiUrl;

    try {
      const res = await cPanelApp.api('/api/ai/prompt');
      const promptBox = document.getElementById('ai-system-prompt-box');
      if (promptBox && res.system_prompt) {
        promptBox.value = res.system_prompt;
      }
    } catch (e) {}
  },

  copySystemPrompt() {
    const box = document.getElementById('ai-system-prompt-box');
    if (box) {
      this.copyText(box.value, document.getElementById('btn-copy-prompt'), 'Copied Prompt!');
    }
  },

  async downloadTools(type) {
    try {
      const res = await cPanelApp.api('/api/ai/tools');
      let data = res.openai;
      let filename = 'cpanel_openai_tools.json';

      if (type === 'claude') {
        data = res.claude;
        filename = 'cpanel_claude_tools.json';
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      cPanelApp.showToast(`Downloaded ${filename}`, 'success');
    } catch (err) {
      cPanelApp.showToast('Failed to download tools JSON: ' + err.message, 'error');
    }
  },

  renderCatalog() {
    const listElem = document.getElementById('api-catalog-list');
    if (!listElem) return;

    listElem.innerHTML = this.endpointsCatalog.map(ep => {
      let methodColor = '#0284c7';
      if (ep.method === 'POST') methodColor = '#10b981';
      if (ep.method === 'DELETE') methodColor = '#ef4444';
      if (ep.method === 'ANY') methodColor = '#8b5cf6';

      return `
        <div class="api-catalog-item" data-search="${(ep.module + ' ' + ep.path + ' ' + ep.desc).toLowerCase()}" style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid #f1f5f9; font-size:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-weight:700; font-size:11px; padding:3px 6px; border-radius:4px; color:#fff; background:${methodColor}; min-width:50px; text-align:center;">${ep.method}</span>
            <code style="font-weight:600; color:#1e293b;">${ep.path}</code>
            <span style="color:#64748b;">${ep.desc}</span>
          </div>
          <span class="badge badge-secondary" style="font-size:10px;">${ep.module}</span>
        </div>
      `;
    }).join('');
  },

  filterCatalog() {
    const query = (document.getElementById('filter-api-catalog').value || '').trim().toLowerCase();
    document.querySelectorAll('.api-catalog-item').forEach(item => {
      const match = !query || item.getAttribute('data-search').includes(query);
      item.style.display = match ? 'flex' : 'none';
    });
  },

  copyText(text, btn = null, successMsg = 'Copied to Clipboard!') {
    navigator.clipboard.writeText(text).then(() => {
      cPanelApp.showToast(successMsg, 'success');
      if (btn) {
        const origHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => { btn.innerHTML = origHtml; }, 2000);
      }
    }).catch(() => {
      cPanelApp.showToast('Failed to copy to clipboard', 'error');
    });
  }
};
