/**
 * cPanel Software Suite: MultiPHP INI Editor, MultiPHP Manager, and Application Manager
 */
const softwareApp = {
  allExtensions: [],

  // =========================================================================
  // 1. MultiPHP INI Editor
  // =========================================================================
  openIniEditor() {
    cPanelApp.openModal('modal-multiphp-ini');
    this.switchIniMode('basic');
    this.loadIniSettings();
  },

  switchIniMode(mode) {
    const basicView = document.getElementById('ini-basic-view');
    const editorView = document.getElementById('ini-editor-view');
    const btnBasic = document.getElementById('btn-ini-mode-basic');
    const btnEditor = document.getElementById('btn-ini-mode-editor');

    if (mode === 'editor') {
      if (basicView) basicView.style.display = 'none';
      if (editorView) editorView.style.display = 'block';
      if (btnBasic) {
        btnBasic.style.background = 'transparent';
        btnBasic.style.color = '#64748b';
        btnBasic.style.boxShadow = 'none';
      }
      if (btnEditor) {
        btnEditor.style.background = '#4f5b93';
        btnEditor.style.color = '#ffffff';
        btnEditor.style.boxShadow = '0 1px 3px rgba(79,91,147,0.25)';
      }
    } else {
      if (basicView) basicView.style.display = 'block';
      if (editorView) editorView.style.display = 'none';
      if (btnBasic) {
        btnBasic.style.background = '#4f5b93';
        btnBasic.style.color = '#ffffff';
        btnBasic.style.boxShadow = '0 1px 3px rgba(79,91,147,0.25)';
      }
      if (btnEditor) {
        btnEditor.style.background = 'transparent';
        btnEditor.style.color = '#64748b';
        btnEditor.style.boxShadow = 'none';
      }
    }
  },

  setPreset(inputId, value) {
    const el = document.getElementById(inputId);
    if (el) {
      el.value = value;
      el.style.borderColor = '#0284c7';
      el.style.boxShadow = '0 0 0 3px rgba(2,132,199,0.15)';
      setTimeout(() => {
        el.style.borderColor = '#cbd5e1';
        el.style.boxShadow = 'none';
      }, 400);
    }
  },

  setToggleState(selectId, val) {
    const sel = document.getElementById(selectId);
    if (sel) sel.value = val;

    if (selectId === 'ini-display-errors') {
      const btnOn = document.getElementById('btn-err-on');
      const btnOff = document.getElementById('btn-err-off');
      if (val === 'On') {
        if (btnOn) { btnOn.style.background = '#0284c7'; btnOn.style.color = '#fff'; btnOn.innerHTML = '<i class="fa-solid fa-check"></i> Enabled (On)'; }
        if (btnOff) { btnOff.style.background = 'transparent'; btnOff.style.color = '#64748b'; btnOff.textContent = 'Disabled (Off)'; }
      } else {
        if (btnOn) { btnOn.style.background = 'transparent'; btnOn.style.color = '#64748b'; btnOn.textContent = 'Enabled (On)'; }
        if (btnOff) { btnOff.style.background = '#64748b'; btnOff.style.color = '#fff'; btnOff.innerHTML = '<i class="fa-solid fa-xmark"></i> Disabled (Off)'; }
      }
    } else if (selectId === 'ini-file-uploads') {
      const btnOn = document.getElementById('btn-up-on');
      const btnOff = document.getElementById('btn-up-off');
      if (val === 'On') {
        if (btnOn) { btnOn.style.background = '#0284c7'; btnOn.style.color = '#fff'; btnOn.innerHTML = '<i class="fa-solid fa-check"></i> Enabled (On)'; }
        if (btnOff) { btnOff.style.background = 'transparent'; btnOff.style.color = '#64748b'; btnOff.textContent = 'Disabled (Off)'; }
      } else {
        if (btnOn) { btnOn.style.background = 'transparent'; btnOn.style.color = '#64748b'; btnOn.textContent = 'Enabled (On)'; }
        if (btnOff) { btnOff.style.background = '#64748b'; btnOff.style.color = '#fff'; btnOff.innerHTML = '<i class="fa-solid fa-xmark"></i> Disabled (Off)'; }
      }
    }
  },

  async loadIniSettings() {
    const refreshIcon = document.getElementById('icon-refresh-ini');
    if (refreshIcon) refreshIcon.classList.add('fa-spin');

    try {
      const data = await cPanelApp.api('/api/software/php-ini');
      if (!data.exists) {
        cPanelApp.showToast('php.ini file not found in XAMPP directory', 'error');
        return;
      }

      const s = data.settings || {};
      const setVal = (id, val, fallback) => {
        const el = document.getElementById(id);
        if (el) el.value = val !== undefined ? val : fallback;
      };

      setVal('ini-memory-limit', s.memory_limit, '512M');
      setVal('ini-upload-max', s.upload_max_filesize, '40M');
      setVal('ini-post-max', s.post_max_size, '40M');
      setVal('ini-max-exec', s.max_execution_time, '120');
      setVal('ini-max-input-time', s.max_input_time, '60');
      setVal('ini-max-input-vars', s.max_input_vars, '1000');
      
      this.setToggleState('ini-display-errors', s.display_errors || 'On');
      this.setToggleState('ini-file-uploads', s.file_uploads || 'On');

      const rawEl = document.getElementById('ini-raw-textarea');
      if (rawEl && data.rawContent) {
        rawEl.value = data.rawContent;
      }
    } catch (err) {
      cPanelApp.showToast(`Failed to load php.ini: ${err.message}`, 'error');
    } finally {
      if (refreshIcon) refreshIcon.classList.remove('fa-spin');
    }
  },

  async saveBasicIni(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('btn-save-ini-basic');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    const settings = {
      memory_limit: document.getElementById('ini-memory-limit').value.trim(),
      upload_max_filesize: document.getElementById('ini-upload-max').value.trim(),
      post_max_size: document.getElementById('ini-post-max').value.trim(),
      max_execution_time: document.getElementById('ini-max-exec').value.trim(),
      max_input_time: document.getElementById('ini-max-input-time').value.trim(),
      max_input_vars: document.getElementById('ini-max-input-vars').value.trim(),
      display_errors: document.getElementById('ini-display-errors').value,
      file_uploads: document.getElementById('ini-file-uploads').value
    };

    try {
      const res = await cPanelApp.api('/api/software/php-ini', {
        method: 'POST',
        body: { settings }
      });
      cPanelApp.showToast(res.message || 'php.ini directives updated successfully.', 'success');
      await this.loadIniSettings();
    } catch (err) {
      cPanelApp.showToast(`Save failed: ${err.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Directives';
      }
    }
  },

  async saveBasicIniAndRestart() {
    const btn = document.getElementById('btn-save-ini-restart');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Applying &amp; Restarting...';
    }

    try {
      await this.saveBasicIni();
      cPanelApp.showToast('Restarting Apache to apply PHP changes...', 'info');
      await cPanelApp.api('/api/xampp/apache/restart', { method: 'POST' });
      cPanelApp.showToast('Apache restarted successfully with updated PHP directives!', 'success');
    } catch (err) {
      cPanelApp.showToast(`Apache restart notice: ${err.message}`, 'warning');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Save &amp; Restart Apache';
      }
    }
  },

  async saveRawIni(restartApache = false) {
    const rawEl = document.getElementById('ini-raw-textarea');
    const btnSave = document.getElementById('btn-save-ini-raw');
    const btnRestart = document.getElementById('btn-save-ini-raw-restart');

    if (!rawEl) return;
    const rawContent = rawEl.value;

    if (restartApache && btnRestart) {
      btnRestart.disabled = true;
      btnRestart.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving &amp; Restarting...';
    } else if (!restartApache && btnSave) {
      btnSave.disabled = true;
      btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {
      cPanelApp.showToast('Saving raw php.ini file...', 'info');
      const res = await cPanelApp.api('/api/software/php-ini/raw', {
        method: 'POST',
        body: { rawContent }
      });
      cPanelApp.showToast(res.message || 'php.ini file saved!', 'success');

      if (restartApache) {
        cPanelApp.showToast('Restarting Apache web server...', 'info');
        await cPanelApp.api('/api/xampp/apache/restart', { method: 'POST' });
        cPanelApp.showToast('Apache restarted with updated configuration!', 'success');
      }
    } catch (err) {
      cPanelApp.showToast(`Failed to save raw php.ini: ${err.message}`, 'error');
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save File';
      }
      if (btnRestart) {
        btnRestart.disabled = false;
        btnRestart.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Save &amp; Restart Apache';
      }
    }
  },

  // =========================================================================
  // 2. MultiPHP Manager
  // =========================================================================
  openPhpManager() {
    cPanelApp.openModal('modal-multiphp-manager');
    this.loadPhpManager();
  },

  async loadPhpManager() {
    const tbody = document.getElementById('mgr-domains-tbody');
    const refreshIcon = document.getElementById('icon-refresh-multiphp');
    if (refreshIcon) refreshIcon.classList.add('fa-spin');

    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Loading PHP manager status...</td></tr>';
    }

    try {
      const [phpData, domainData] = await Promise.all([
        cPanelApp.api('/api/software/php'),
        cPanelApp.api('/api/software/multiphp/domains')
      ]);

      // Fill runtime info
      const setTxt = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
      };
      setTxt('mgr-php-version', `PHP ${phpData.version}`);
      setTxt('mgr-php-sapi', phpData.sapi || 'Apache 2.0 Handler');
      setTxt('mgr-php-arch', phpData.architecture || 'x64 (Win64)');
      setTxt('mgr-php-zend', phpData.zendVersion || 'Zend Engine v4.2.12');
      setTxt('mgr-php-bin', phpData.exePath || 'C:\\xampp\\php\\php.exe');
      setTxt('mgr-php-ini', phpData.iniPath || 'C:\\xampp\\php\\php.ini');

      // Fill extensions
      this.allExtensions = phpData.extensions || [];
      const countEl = document.getElementById('mgr-ext-count');
      if (countEl) countEl.textContent = `${this.allExtensions.length} Active`;
      this.activeExtCategory = 'all';
      this.renderExtensions(this.allExtensions);

      // Fill domains
      this.allDomains = domainData.domains || [];
      this.renderDomains(this.allDomains);

    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:24px;"><i class="fa-solid fa-triangle-exclamation"></i> ${cPanelApp.escapeHtml(err.message)}</td></tr>`;
      }
      cPanelApp.showToast(`MultiPHP Manager: ${err.message}`, 'error');
    } finally {
      if (refreshIcon) refreshIcon.classList.remove('fa-spin');
    }
  },

  renderDomains(domains) {
    const tbody = document.getElementById('mgr-domains-tbody');
    if (!tbody) return;

    if (!domains || domains.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:24px;">No matching domains found.</td></tr>';
      return;
    }

    tbody.innerHTML = domains.map(d => {
      const isPrimary = (d.type === 'primary' || d.domain === 'localhost');
      const badgeStyle = isPrimary
        ? 'background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;'
        : 'background:#f3e8ff; color:#7e22ce; border:1px solid #e9d5ff;';
      const badgeText = isPrimary ? 'PRIMARY' : (d.type || 'ADDON').toUpperCase();

      return `
        <tr style="border-bottom:1px solid #f1f5f9; transition:background-color 0.15s ease;">
          <td style="padding:12px 16px; vertical-align:middle;">
            <div style="display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-globe" style="color:#0284c7; font-size:13px;"></i>
              <strong style="font-size:13.5px; color:#0f172a;">${cPanelApp.escapeHtml(d.domain)}</strong>
              <span style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:12px; letter-spacing:0.5px; ${badgeStyle}">
                ${badgeText}
              </span>
            </div>
          </td>
          <td style="padding:12px 16px; vertical-align:middle;">
            <span style="background:#f8fafc; border:1px solid #e2e8f0; padding:4px 8px; border-radius:5px; font-family:'Consolas',monospace; font-size:11.5px; color:#475569; display:inline-flex; align-items:center; gap:6px; max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${cPanelApp.escapeHtml(d.documentRoot || '-')}">
              <i class="fa-regular fa-folder" style="color:#94a3b8; font-size:12px;"></i>
              ${cPanelApp.escapeHtml(d.documentRoot || '-')}
            </span>
          </td>
          <td style="padding:12px 16px; vertical-align:middle;">
            <select id="sel-php-ver-${d.id}" style="width:100%; height:36px; padding:6px 12px; font-size:12.5px; font-weight:500; color:#1e293b; background-color:#ffffff; border:1px solid #cbd5e1; border-radius:6px; outline:none; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.05); transition:border-color 0.15s ease;">
              <option value="PHP 8.2 (System)" ${(d.phpVersion || '').includes('8.2') || !d.phpVersion ? 'selected' : ''}>PHP 8.2 (System)</option>
              <option value="PHP 8.1 (FastCGI)" ${(d.phpVersion || '').includes('8.1') ? 'selected' : ''}>PHP 8.1 (FastCGI)</option>
              <option value="PHP 7.4 (Legacy)" ${(d.phpVersion || '').includes('7.4') ? 'selected' : ''}>PHP 7.4 (Legacy)</option>
            </select>
          </td>
          <td style="padding:12px 16px; vertical-align:middle; text-align:center;">
            <div style="display:flex; justify-content:center; align-items:center;">
              <label style="position:relative; display:inline-flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin:0;">
                <input type="checkbox" id="chk-fpm-${d.id}" ${d.fpmEnabled ? 'checked' : ''} onchange="softwareApp.toggleFpmBadge('${d.id}')" style="display:none;">
                <span id="fpm-switch-${d.id}" style="width:36px; height:20px; background:${d.fpmEnabled ? '#0284c7' : '#cbd5e1'}; border-radius:10px; position:relative; transition:background-color 0.2s; display:inline-block;">
                  <span style="position:absolute; top:2px; left:${d.fpmEnabled ? '18px' : '2px'}; width:16px; height:16px; border-radius:50%; background:#ffffff; transition:left 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.2);"></span>
                </span>
                <span id="fpm-text-${d.id}" style="font-size:11px; font-weight:700; color:${d.fpmEnabled ? '#0284c7' : '#64748b'}; min-width:55px; text-align:left;">
                  ${d.fpmEnabled ? 'Active' : 'Disabled'}
                </span>
              </label>
            </div>
          </td>
          <td style="padding:12px 16px; vertical-align:middle; text-align:right;">
            <button class="btn-primary btn-sm" id="btn-apply-${d.id}" onclick="softwareApp.saveDomainPhp('${d.domain}', '${d.id}')" style="background:#0284c7; color:#ffffff; border:1px solid #0369a1; padding:6px 14px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 1px 2px rgba(2,132,199,0.2); transition:all 0.15s ease;">
              <i class="fa-solid fa-check"></i> Apply
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  toggleFpmBadge(id) {
    const chk = document.getElementById(`chk-fpm-${id}`);
    const sw = document.getElementById(`fpm-switch-${id}`);
    const txt = document.getElementById(`fpm-text-${id}`);
    if (!chk || !sw || !txt) return;

    const checked = chk.checked;
    sw.style.backgroundColor = checked ? '#0284c7' : '#cbd5e1';
    const thumb = sw.querySelector('span');
    if (thumb) thumb.style.left = checked ? '18px' : '2px';
    txt.textContent = checked ? 'Active' : 'Disabled';
    txt.style.color = checked ? '#0284c7' : '#64748b';
  },

  filterDomains(query) {
    const q = (query || '').toLowerCase().trim();
    if (!this.allDomains) return;
    if (!q) {
      this.renderDomains(this.allDomains);
      return;
    }
    const filtered = this.allDomains.filter(d =>
      (d.domain && d.domain.toLowerCase().includes(q)) ||
      (d.documentRoot && d.documentRoot.toLowerCase().includes(q))
    );
    this.renderDomains(filtered);
  },

  async saveDomainPhp(domain, id) {
    const sel = document.getElementById(`sel-php-ver-${id}`);
    const chk = document.getElementById(`chk-fpm-${id}`);
    const btn = document.getElementById(`btn-apply-${id}`);
    const phpVersion = sel ? sel.value : 'PHP 8.2 (System)';
    const fpmEnabled = chk ? chk.checked : false;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {
      const res = await cPanelApp.api('/api/software/multiphp/domains', {
        method: 'POST',
        body: { domain, phpVersion, fpmEnabled }
      });
      cPanelApp.showToast(res.message || `Updated PHP version for ${domain}`, 'success');
      await this.loadPhpManager();
    } catch (err) {
      cPanelApp.showToast(`Failed to update domain PHP: ${err.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Apply';
      }
    }
  },

  renderExtensions(list) {
    const container = document.getElementById('mgr-extensions-container');
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML = '<div style="color:#64748b; font-size:12px; padding:12px; width:100%; text-align:center;">No matching extensions found.</div>';
      return;
    }

    container.innerHTML = list.map(ext => {
      const norm = ext.toLowerCase();

      // Categorization and custom badge color styles
      let icon = 'fa-solid fa-code';
      let bg = '#ffffff';
      let color = '#334155';
      let border = '#cbd5e1';

      if (['mysqli', 'pdo', 'pdo_mysql', 'pdo_sqlite', 'sqlite3', 'mysqlnd'].includes(norm)) {
        icon = 'fa-solid fa-database';
        bg = '#e0f2fe';
        color = '#0369a1';
        border = '#bae6fd';
      } else if (['openssl', 'hash', 'filter', 'sodium'].includes(norm)) {
        icon = 'fa-solid fa-shield-halved';
        bg = '#dcfce7';
        color = '#15803d';
        border = '#bbf7d0';
      } else if (['curl', 'mbstring', 'json', 'xml', 'simplexml', 'libxml', 'dom', 'exif', 'iconv'].includes(norm)) {
        icon = 'fa-solid fa-globe';
        bg = '#f3e8ff';
        color = '#7e22ce';
        border = '#e9d5ff';
      } else if (['zip', 'phar', 'fileinfo', 'bz2', 'zlib'].includes(norm)) {
        icon = 'fa-solid fa-box-archive';
        bg = '#fef3c7';
        color = '#b45309';
        border = '#fde68a';
      }

      return `
        <span style="font-size:11.5px; padding:4px 10px; border-radius:6px; background:${bg}; color:${color}; font-weight:600; border:1px solid ${border}; display:inline-flex; align-items:center; gap:5px; box-shadow:0 1px 2px rgba(0,0,0,0.02); transition:transform 0.15s, box-shadow 0.15s; cursor:default;" title="Extension: ${cPanelApp.escapeHtml(ext)}">
          <i class="${icon}" style="font-size:10px; opacity:0.85;"></i>
          ${cPanelApp.escapeHtml(ext)}
        </span>
      `;
    }).join('');
  },

  filterExtCategory(cat, btnEl) {
    this.activeExtCategory = cat;
    // Update tab styling
    const tabs = document.querySelectorAll('#ext-filter-tabs button');
    tabs.forEach(t => {
      t.style.background = '#f1f5f9';
      t.style.color = '#475569';
      t.style.borderColor = '#cbd5e1';
    });
    if (btnEl) {
      btnEl.style.background = '#0284c7';
      btnEl.style.color = '#ffffff';
      btnEl.style.borderColor = '#0369a1';
    }

    this.applyExtensionsFilter();
  },

  filterExtensions(query) {
    this.extSearchQuery = (query || '').toLowerCase().trim();
    this.applyExtensionsFilter();
  },

  applyExtensionsFilter() {
    if (!this.allExtensions) return;
    let list = this.allExtensions;

    // Apply category filter
    const cat = this.activeExtCategory || 'all';
    if (cat === 'database') {
      const dbExts = ['mysqli', 'pdo', 'pdo_mysql', 'pdo_sqlite', 'sqlite3', 'mysqlnd'];
      list = list.filter(e => dbExts.includes(e.toLowerCase()));
    } else if (cat === 'security') {
      const secExts = ['openssl', 'hash', 'filter', 'sodium'];
      list = list.filter(e => secExts.includes(e.toLowerCase()));
    } else if (cat === 'web') {
      const webExts = ['curl', 'mbstring', 'json', 'xml', 'simplexml', 'libxml', 'dom', 'exif', 'iconv'];
      list = list.filter(e => webExts.includes(e.toLowerCase()));
    } else if (cat === 'core') {
      const coreExts = ['core', 'standard', 'date', 'pcre', 'spl', 'reflection', 'session', 'tokenizer', 'ctype', 'random', 'readline'];
      list = list.filter(e => coreExts.includes(e.toLowerCase()));
    }

    // Apply text search
    if (this.extSearchQuery) {
      list = list.filter(e => e.toLowerCase().includes(this.extSearchQuery));
    }

    this.renderExtensions(list);
  },

  // =========================================================================
  // 3. Application Manager
  // =========================================================================
  openAppManager() {
    cPanelApp.openModal('modal-app-manager');
    this.loadApplications();
  },

  toggleNewAppForm() {
    const drawer = document.getElementById('app-manager-drawer');
    if (drawer) {
      drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
      if (drawer.style.display === 'block') {
        drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  },

  async loadApplications() {
    const tbody = document.getElementById('app-manager-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:16px;"><i class="fa-solid fa-spinner fa-spin"></i> Inspecting registered applications...</td></tr>';
    }

    try {
      const data = await cPanelApp.api('/api/software/apps');
      const apps = data.apps || [];

      if (!tbody) return;

      if (apps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:20px;">No applications registered. Click "Register Application" to add your web app.</td></tr>';
        return;
      }

      tbody.innerHTML = apps.map(app => {
        const isRunning = app.status === 'running';
        const healthBadge = isRunning
          ? `<span class="badge badge-success" style="font-size:11px;"><i class="fa-solid fa-circle-check"></i> 200 OK (${app.latencyMs || 2}ms)</span>`
          : `<span class="badge badge-danger" style="font-size:11px;"><i class="fa-solid fa-circle-exclamation"></i> Offline</span>`;

        return `
          <tr>
            <td>
              <strong>${cPanelApp.escapeHtml(app.name)}</strong>
              <div style="font-size:11px; color:#64748b; margin-top:2px;">
                <a href="${app.url}" target="_blank" style="color:#0284c7; text-decoration:none;">
                  <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px;"></i> ${cPanelApp.escapeHtml(app.url)}
                </a>
              </div>
            </td>
            <td><code style="font-size:12px; color:#334155;">${cPanelApp.escapeHtml(app.path)}</code></td>
            <td>
              <span style="font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; background:#eff6ff; color:#1e40af;">
                ${cPanelApp.escapeHtml(app.type || 'PHP')}
              </span>
            </td>
            <td>${healthBadge}</td>
            <td style="text-align:right; white-space:nowrap;">
              <a href="${app.url}" target="_blank" class="btn-secondary btn-xs" title="Open in browser">
                <i class="fa-solid fa-globe"></i> Open
              </a>
              <button class="btn-secondary btn-xs" onclick="softwareApp.checkHealth('${app.id}')" title="Test application ping">
                <i class="fa-solid fa-heart-pulse"></i> Ping
              </button>
              ${app.id !== 'app_wp' && app.id !== 'app_root' ? `
                <button class="btn-danger btn-xs" onclick="softwareApp.deleteApp('${app.id}', '${app.name}')" title="Unregister this application">
                  <i class="fa-solid fa-trash"></i>
                </button>
              ` : ''}
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:16px;">${cPanelApp.escapeHtml(err.message)}</td></tr>`;
      }
      cPanelApp.showToast(`Application Manager: ${err.message}`, 'error');
    }
  },

  async handleRegisterApp(e) {
    if (e) e.preventDefault();
    const nameInput = document.getElementById('app-new-name');
    const pathInput = document.getElementById('app-new-path');
    const typeSelect = document.getElementById('app-new-type');
    const docRootInput = document.getElementById('app-new-docroot');
    const btn = document.getElementById('btn-submit-new-app');

    const name = (nameInput ? nameInput.value : '').trim();
    const path = (pathInput ? pathInput.value : '').trim();
    const type = typeSelect ? typeSelect.value : 'PHP / CMS';
    const docRoot = docRootInput ? docRootInput.value.trim() : '';

    if (!name || !path) {
      cPanelApp.showToast('Please provide an Application Name and Path.', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering...';
    }

    try {
      const res = await cPanelApp.api('/api/software/apps', {
        method: 'POST',
        body: { name, path, type, docRoot }
      });
      cPanelApp.showToast(res.message || `Application "${name}" registered!`, 'success');
      if (nameInput) nameInput.value = '';
      if (pathInput) pathInput.value = '';
      if (docRootInput) docRootInput.value = '';
      this.toggleNewAppForm();
      this.loadApplications();
    } catch (err) {
      cPanelApp.showToast(`Registration failed: ${err.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Save Application';
      }
    }
  },

  async checkHealth(id) {
    try {
      cPanelApp.showToast('Pinging application...', 'info');
      const data = await cPanelApp.api(`/api/software/apps/${id}/health`, { method: 'POST' });
      const h = data.health;
      if (h.healthy) {
        cPanelApp.showToast(`${h.name}: Status ${h.statusCode} OK (${h.latencyMs}ms)`, 'success');
      } else {
        cPanelApp.showToast(`${h.name}: Offline (${h.error || 'Status ' + h.statusCode})`, 'error');
      }
      this.loadApplications();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  async deleteApp(id, name) {
    if (!confirm(`Are you sure you want to unregister application "${name}"? This removes the application entry from cPanel.`)) {
      return;
    }

    try {
      const res = await cPanelApp.api(`/api/software/apps/${id}`, { method: 'DELETE' });
      cPanelApp.showToast(res.message || 'Application unregistered.', 'success');
      this.loadApplications();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  }
};

window.softwareApp = softwareApp;
