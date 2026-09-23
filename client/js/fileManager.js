// ==========================================================================
// cPanel File Manager & Built-in Code Editor
// ==========================================================================

const fileManager = {
  currentPath: '/',
  selectedItem: null,
  activeEditingFile: null,
  pendingEditFile: null,
  currentZoom: 1.0,
  currentImageItem: null,

  isImageFile(filePath) {
    if (!filePath) return false;
    return /\.(png|jpe?g|gif|svg|webp|ico|bmp|avif)$/i.test(filePath);
  },

  isBinaryFile(filePath) {
    if (!filePath) return false;
    return /\.(png|jpe?g|gif|svg|webp|ico|bmp|avif|zip|tar|gz|rar|7z|exe|dll|pdf|mp3|mp4)$/i.test(filePath);
  },

  init() {
    this.setupListeners();
  },

  async open() {
    cPanelApp.openModal('modal-file-manager');
    await this.navigateTo('/');
  },

  async navigateTo(path) {
    this.currentPath = path;
    this.selectedItem = null;
    this.updateToolbarState();

    const tbody = document.getElementById('fm-file-list');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Reading directory...</td></tr>';

    try {
      const data = await cPanelApp.api(`/api/files/list?path=${encodeURIComponent(path)}`);
      this.currentPath = data.currentPath;
      this.renderBreadcrumbs(data.currentPath);
      this.renderFileList(data.items);
      this.renderTree(data.items);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
      cPanelApp.showToast(err.message, 'error');
    }
  },

  renderBreadcrumbs(currentPath) {
    const bar = document.getElementById('fm-breadcrumbs');
    const parts = currentPath.split('/').filter(Boolean);
    let accum = '';

    let html = `<a href="#" onclick="fileManager.navigateTo('/')"><i class="fa-solid fa-house" style="margin-right:4px;"></i> /home/localhost</a>`;

    for (let i = 0; i < parts.length; i++) {
      accum += '/' + parts[i];
      const linkPath = accum;
      const isWebRoot = (parts[i] === 'public_html');
      html += ` <span style="color:#cbd5e1;">/</span> <a href="#" onclick="fileManager.navigateTo('${linkPath}')">${isWebRoot ? '<i class="fa-solid fa-globe text-primary" style="margin-right:4px;"></i>' : ''}${parts[i]}</a>`;
    }

    bar.innerHTML = html;
  },

  renderFileList(items) {
    const tbody = document.getElementById('fm-file-list');
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">This folder is empty.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(item => {
      let icon = 'fa-file';
      let extraBadge = '';
      if (item.isDir) {
        if (item.name === 'public_html') {
          icon = 'fa-globe text-primary';
          extraBadge = '<span class="service-badge" style="margin-left:8px; font-size:10px; background:#eff6ff; color:#2563eb; font-weight:700;">Web Root</span>';
        } else if (item.name === 'www') {
          icon = 'fa-link text-info';
          extraBadge = '<span style="color:#94a3b8; font-size:11px; margin-left:6px;">&rarr; public_html</span>';
        } else if (item.name === 'mail') {
          icon = 'fa-envelope text-warning';
        } else if (item.name === 'ssl') {
          icon = 'fa-lock text-success';
        } else if (item.name === 'logs') {
          icon = 'fa-file-lines text-secondary';
        } else if (item.name === '.trash') {
          icon = 'fa-trash-can text-danger';
        } else if (item.name === 'wordpress') {
          icon = 'fa-brands fa-wordpress text-primary';
        } else {
          icon = 'fa-folder text-warning';
        }
      } else if (item.extension === '.php') icon = 'fa-brands fa-php text-primary';
      else if (['.html', '.htm'].includes(item.extension)) icon = 'fa-brands fa-html5 text-danger';
      else if (['.js', '.json'].includes(item.extension)) icon = 'fa-brands fa-js text-warning';
      else if (['.css', '.scss'].includes(item.extension)) icon = 'fa-brands fa-css3-alt text-primary';
      else if (item.extension === '.zip') icon = 'fa-file-zipper text-success';
      else if (['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico', '.bmp'].includes(item.extension)) icon = 'fa-image text-info';

      const sizeDisplay = item.isDir ? '--' : this.formatSize(item.size);
      const encodedPath = encodeURIComponent(item.path);

      return `
        <tr class="file-row" data-path="${encodedPath}" data-isdir="${item.isDir}" onclick="fileManager.selectItem(this, decodeURIComponent('${encodedPath}'), ${item.isDir})" ondblclick="fileManager.handleDblClick(decodeURIComponent('${encodedPath}'), ${item.isDir})" oncontextmenu="fileManager.handleContextMenu(event, decodeURIComponent('${encodedPath}'), ${item.isDir}, this)">
          <td>
            <i class="fa-solid ${icon}" style="margin-right: 8px;"></i>
            <strong>${item.name}</strong>
            ${extraBadge}
          </td>
          <td>${sizeDisplay}</td>
          <td>${item.mime}</td>
          <td>${new Date(item.mtime).toLocaleString()}</td>
          <td><code>${item.permissions}</code></td>
        </tr>
      `;
    }).join('');
  },

  handleContextMenu(e, path, isDir, rowEl) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.selectItem(rowEl, path, isDir);
    if (window.cPanelContextMenu) {
      window.cPanelContextMenu.showFileItemMenu(e, path, isDir);
    }
  },

  renderTree(items) {
    const tree = document.getElementById('fm-folder-tree');
    tree.innerHTML = `
      <div style="font-weight:700; cursor:pointer; padding:6px 8px; border-radius:4px; display:flex; align-items:center; gap:8px;" onclick="fileManager.navigateTo('/')">
        <i class="fa-solid fa-house text-primary"></i> /home/localhost
      </div>
      <div style="padding-left:14px; margin-top:4px;">
        <div style="font-weight:600; cursor:pointer; padding:4px 8px; border-radius:4px; color:#2563eb; background:#eff6ff; margin-bottom:4px; display:flex; align-items:center; gap:6px;" onclick="fileManager.navigateTo('/public_html')">
          <i class="fa-solid fa-globe"></i> public_html
        </div>
        ${items.filter(i => i.isDir && i.name !== 'public_html').map(d => `
          <div style="cursor:pointer; padding:3px 8px; color:#334155; display:flex; align-items:center; gap:6px;" onclick="fileManager.navigateTo('${d.path}')">
            <i class="fa-solid ${d.name === 'mail' ? 'fa-envelope text-warning' : (d.name === 'ssl' ? 'fa-lock text-success' : (d.name === 'www' ? 'fa-link text-info' : 'fa-folder text-warning'))}"></i> ${d.name}
          </div>
        `).join('')}
      </div>
    `;
  },

  selectItem(rowEl, path, isDir) {
    document.querySelectorAll('.file-row').forEach(r => r.classList.remove('selected'));
    if (rowEl) rowEl.classList.add('selected');
    this.selectedItem = { path, isDir, name: path.split('/').pop() };
    this.updateToolbarState();
  },

  handleDblClick(path, isDir) {
    if (isDir) {
      this.navigateTo(path);
    } else if (this.isImageFile(path)) {
      this.openImageViewer(path);
    } else if (this.isBinaryFile(path)) {
      cPanelApp.showToast('Binary files cannot be opened in Code Editor. Use Download instead.', 'info');
    } else {
      this.openEditConfirmModal(path);
    }
  },

  updateToolbarState() {
    const hasSelection = !!this.selectedItem;
    const isDir = !!(this.selectedItem && this.selectedItem.isDir);
    const itemPath = (this.selectedItem && this.selectedItem.path) ? this.selectedItem.path : '';
    const isZip = itemPath.toLowerCase().endsWith('.zip');
    const isImage = this.isImageFile(itemPath);
    const isBinary = this.isBinaryFile(itemPath);

    const btnDownload = document.getElementById('fm-btn-download');
    const btnEdit = document.getElementById('fm-btn-edit');
    const btnView = document.getElementById('fm-btn-view');
    const btnDelete = document.getElementById('fm-btn-delete');
    const btnRename = document.getElementById('fm-btn-rename');
    const btnExtract = document.getElementById('fm-btn-extract');

    if (btnDownload) btnDownload.disabled = !hasSelection || isDir;
    if (btnView) btnView.disabled = !hasSelection || isDir;
    if (btnEdit) btnEdit.disabled = !hasSelection || isDir || (isBinary && !isImage);
    if (btnDelete) btnDelete.disabled = !hasSelection;
    if (btnRename) btnRename.disabled = !hasSelection;
    if (btnExtract) btnExtract.disabled = !hasSelection || !isZip;
  },

  // File Actions
  async promptNewFile() {
    const name = prompt('Enter new file name (e.g. index.php, style.css):');
    if (!name) return;

    try {
      await cPanelApp.api('/api/files/create-file', {
        method: 'POST',
        body: { dir: this.currentPath, name }
      });
      cPanelApp.showToast(`File "${name}" created!`, 'success');
      await this.navigateTo(this.currentPath);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  async promptNewFolder() {
    const name = prompt('Enter new folder name:');
    if (!name) return;

    try {
      await cPanelApp.api('/api/files/create-folder', {
        method: 'POST',
        body: { dir: this.currentPath, name }
      });
      cPanelApp.showToast(`Folder "${name}" created!`, 'success');
      await this.navigateTo(this.currentPath);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // 1. Move Modal
  openMoveModal(item) {
    const target = item || this.selectedItem;
    if (!target) return;
    this.selectedItem = target;
    const itemNameEl = document.getElementById('move-item-name');
    const destPathInput = document.getElementById('move-dest-path');
    if (itemNameEl) itemNameEl.textContent = target.name;
    if (destPathInput) destPathInput.value = this.currentPath;
    cPanelApp.openModal('modal-fm-move');
  },

  async submitMove() {
    if (!this.selectedItem) return;
    const destDir = document.getElementById('move-dest-path').value.trim() || '/';
    try {
      await cPanelApp.api('/api/files/move', {
        method: 'POST',
        body: { path: this.selectedItem.path, destDir }
      });
      cPanelApp.closeModal('modal-fm-move');
      cPanelApp.showToast(`Moved "${this.selectedItem.name}" to ${destDir}`, 'success');
      await this.navigateTo(this.currentPath);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // 2. Copy Modal
  openCopyModal(item) {
    const target = item || this.selectedItem;
    if (!target) return;
    this.selectedItem = target;
    const itemNameEl = document.getElementById('copy-item-name');
    const destPathInput = document.getElementById('copy-dest-path');
    if (itemNameEl) itemNameEl.textContent = target.name;
    if (destPathInput) destPathInput.value = this.currentPath;
    cPanelApp.openModal('modal-fm-copy');
  },

  async submitCopy() {
    if (!this.selectedItem) return;
    const destDir = document.getElementById('copy-dest-path').value.trim() || '/';
    try {
      const res = await cPanelApp.api('/api/files/copy', {
        method: 'POST',
        body: { path: this.selectedItem.path, destDir }
      });
      cPanelApp.closeModal('modal-fm-copy');
      cPanelApp.showToast(`Created copy: "${res.name}" in ${destDir}`, 'success');
      await this.navigateTo(this.currentPath);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // 3. Rename Modal
  openRenameModal(item) {
    const target = item || this.selectedItem;
    if (!target) return;
    this.selectedItem = target;
    const input = document.getElementById('rename-new-name');
    if (input) input.value = target.name;
    cPanelApp.openModal('modal-fm-rename');
  },

  async submitRename() {
    if (!this.selectedItem) return;
    const newName = document.getElementById('rename-new-name').value.trim();
    if (!newName || newName === this.selectedItem.name) {
      cPanelApp.closeModal('modal-fm-rename');
      return;
    }
    try {
      await cPanelApp.api('/api/files/rename', {
        method: 'POST',
        body: { path: this.selectedItem.path, newName }
      });
      cPanelApp.closeModal('modal-fm-rename');
      cPanelApp.showToast('Item renamed successfully!', 'success');
      await this.navigateTo(this.currentPath);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // 4. Change Permissions Modal (Interactive 3x3 Grid)
  openPermissionsModal(item) {
    const target = item || this.selectedItem;
    if (!target) return;
    this.selectedItem = target;
    const nameEl = document.getElementById('perm-item-name');
    if (nameEl) nameEl.textContent = target.name;

    const raw = String(target.permissions || '644');
    const digits = raw.slice(-3).padStart(3, '6');
    const u = parseInt(digits[0], 10) || 6;
    const g = parseInt(digits[1], 10) || 4;
    const w = parseInt(digits[2], 10) || 4;

    const setCheck = (id, checked) => {
      const el = document.getElementById(id);
      if (el) el.checked = checked;
    };

    setCheck('perm-u-r', !!(u & 4));
    setCheck('perm-u-w', !!(u & 2));
    setCheck('perm-u-x', !!(u & 1));

    setCheck('perm-g-r', !!(g & 4));
    setCheck('perm-g-w', !!(g & 2));
    setCheck('perm-g-x', !!(g & 1));

    setCheck('perm-w-r', !!(w & 4));
    setCheck('perm-w-w', !!(w & 2));
    setCheck('perm-w-x', !!(w & 1));

    this.calcPerms();
    cPanelApp.openModal('modal-fm-permissions');
  },

  calcPerms() {
    const getVal = (id) => (document.getElementById(id) && document.getElementById(id).checked);
    const ur = getVal('perm-u-r') ? 4 : 0;
    const uw = getVal('perm-u-w') ? 2 : 0;
    const ux = getVal('perm-u-x') ? 1 : 0;

    const gr = getVal('perm-g-r') ? 4 : 0;
    const gw = getVal('perm-g-w') ? 2 : 0;
    const gx = getVal('perm-g-x') ? 1 : 0;

    const wr = getVal('perm-w-r') ? 4 : 0;
    const ww = getVal('perm-w-w') ? 2 : 0;
    const wx = getVal('perm-w-x') ? 1 : 0;

    const val = `0${ur + uw + ux}${gr + gw + gx}${wr + ww + wx}`;
    const display = document.getElementById('perm-val-display');
    if (display) display.textContent = val;
    return val;
  },

  async submitChmod() {
    if (!this.selectedItem) return;
    const mode = this.calcPerms();
    try {
      await cPanelApp.api('/api/files/chmod', {
        method: 'POST',
        body: { path: this.selectedItem.path, mode }
      });
      cPanelApp.closeModal('modal-fm-permissions');
      cPanelApp.showToast(`Permissions updated to ${mode}!`, 'success');
      await this.navigateTo(this.currentPath);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // 5. Delete Modal
  openDeleteModal(item) {
    const target = item || this.selectedItem;
    if (!target) return;
    this.selectedItem = target;
    const nameEl = document.getElementById('delete-item-name');
    if (nameEl) nameEl.textContent = target.name;
    cPanelApp.openModal('modal-fm-delete');
  },

  async submitDelete() {
    if (!this.selectedItem) return;
    const name = this.selectedItem.name;
    try {
      await cPanelApp.api('/api/files/delete', {
        method: 'POST',
        body: { path: this.selectedItem.path }
      });
      cPanelApp.closeModal('modal-fm-delete');
      cPanelApp.showToast(`"${name}" deleted.`, 'info');
      await this.navigateTo(this.currentPath);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // 6. Compress Modal
  openCompressModal(item) {
    const target = item || this.selectedItem;
    if (!target) return;
    this.selectedItem = target;
    const nameEl = document.getElementById('compress-item-name');
    const archiveNameInput = document.getElementById('compress-archive-name');
    if (nameEl) nameEl.textContent = target.name;
    if (archiveNameInput) archiveNameInput.value = `${target.name}.zip`;
    cPanelApp.openModal('modal-fm-compress');
  },

  async submitCompress() {
    if (!this.selectedItem) return;
    const zipName = document.getElementById('compress-archive-name').value.trim() || `${this.selectedItem.name}.zip`;
    try {
      await cPanelApp.api('/api/files/compress', {
        method: 'POST',
        body: {
          items: [this.selectedItem.path],
          zipName,
          destinationDir: this.currentPath
        }
      });
      cPanelApp.closeModal('modal-fm-compress');
      cPanelApp.showToast(`Compressed into "${zipName}"!`, 'success');
      await this.navigateTo(this.currentPath);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // 7. Extract Modal
  openExtractModal(item) {
    const target = item || this.selectedItem;
    if (!target) return;
    this.selectedItem = target;
    const nameEl = document.getElementById('extract-item-name');
    const destInput = document.getElementById('extract-dest-path');
    if (nameEl) nameEl.textContent = target.name;
    if (destInput) destInput.value = this.currentPath;
    cPanelApp.openModal('modal-fm-extract');
  },

  async submitExtract() {
    if (!this.selectedItem) return;
    const targetDir = document.getElementById('extract-dest-path').value.trim() || this.currentPath;
    try {
      await cPanelApp.api('/api/files/extract', {
        method: 'POST',
        body: { zipPath: this.selectedItem.path, targetDir }
      });
      cPanelApp.closeModal('modal-fm-extract');
      cPanelApp.showToast('Archive extracted successfully!', 'success');
      await this.navigateTo(this.currentPath);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // 8. Dedicated Read-Only View Modal (Independent from Edit!)
  async openReadOnlyViewer(filePath) {
    const cleanPath = filePath || (this.selectedItem ? this.selectedItem.path : null);
    if (!cleanPath) return;

    if (this.isImageFile(cleanPath)) {
      this.openImageViewer(cleanPath);
      return;
    }

    try {
      const data = await cPanelApp.api(`/api/files/read?path=${encodeURIComponent(cleanPath)}`);
      this.activeViewFile = cleanPath;

      document.getElementById('view-file-title').textContent = data.name;
      document.getElementById('view-file-path').textContent = data.path;
      document.getElementById('view-code-pre').textContent = data.content;

      const lines = data.content.split('\n').length;
      document.getElementById('view-file-stats').textContent = `Lines: ${lines} | Size: ${this.formatSize(data.size)} | Read-Only Mode`;

      cPanelApp.openModal('modal-fm-view');
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  switchToEditFromView() {
    cPanelApp.closeModal('modal-fm-view');
    if (this.activeViewFile) {
      this.openEditConfirmModal(this.activeViewFile);
    }
  },

  // 9. Password Protect / Directory Privacy Modal
  async openDirectoryPrivacy(dirPath = '/public_html') {
    const inputEl = document.getElementById('privacy-dir-input');
    const selectEl = document.getElementById('privacy-dir-select');
    if (inputEl) inputEl.value = dirPath || '/public_html';

    // Populate subdirectories in select dropdown
    if (selectEl) {
      selectEl.innerHTML = '<option value="/public_html">/public_html</option>';
      try {
        const res = await cPanelApp.api('/api/files/list?path=/public_html');
        if (res && res.items) {
          res.items.filter(i => i.isDir).forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.path;
            opt.textContent = d.name;
            if (d.path === dirPath) opt.selected = true;
            selectEl.appendChild(opt);
          });
        }
      } catch (e) {}
    }

    cPanelApp.openModal('modal-fm-privacy');
  },

  openPrivacyModal(item) {
    const targetPath = (item && item.path) ? item.path : (this.selectedItem ? this.selectedItem.path : this.currentPath);
    this.openDirectoryPrivacy(targetPath);
  },

  async submitPrivacy() {
    const dirInput = document.getElementById('privacy-dir-input');
    const dir = dirInput ? dirInput.value.trim() : '/public_html';
    const enabled = document.getElementById('privacy-enabled').checked;
    const authName = document.getElementById('privacy-auth-name').value.trim();
    const username = document.getElementById('privacy-user').value.trim();
    const password = document.getElementById('privacy-pass').value.trim();

    if (enabled && (!username || !password)) {
      cPanelApp.showToast('Please enter an authorized username and password to protect the directory.', 'warning');
      return;
    }

    try {
      await cPanelApp.api('/api/files/protect-dir', {
        method: 'POST',
        body: { dir, authName, username, password, enabled }
      });
      cPanelApp.closeModal('modal-fm-privacy');
      cPanelApp.showToast(enabled ? `Directory Privacy enabled for "${dir}"!` : `Directory Privacy disabled for "${dir}"!`, 'success');
      if (this.currentPath) await this.navigateTo(this.currentPath);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // 10. Leech Protection Modal
  openLeechModal(item) {
    const targetPath = (item && item.path) ? item.path : (this.selectedItem ? this.selectedItem.path : this.currentPath);
    const dirEl = document.getElementById('leech-dir-name');
    if (dirEl) dirEl.textContent = targetPath;
    cPanelApp.openModal('modal-fm-leech');
  },

  async submitLeech() {
    const dir = document.getElementById('leech-dir-name').textContent.trim();
    const maxLogins = parseInt(document.getElementById('leech-max-logins').value, 10) || 4;
    const redirectUrl = document.getElementById('leech-redirect-url').value.trim();
    const disableCompromised = document.getElementById('leech-disable-compromised').checked;

    try {
      await cPanelApp.api('/api/files/leech-protect', {
        method: 'POST',
        body: { dir, maxLogins, redirectUrl, disableCompromised }
      });
      cPanelApp.closeModal('modal-fm-leech');
      cPanelApp.showToast(`Leech Protection active for "${dir}"!`, 'success');
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // 11. Index Manager Modal
  openIndicesModal(item) {
    const targetPath = (item && item.path) ? item.path : (this.selectedItem ? this.selectedItem.path : this.currentPath);
    const dirEl = document.getElementById('indices-dir-name');
    if (dirEl) dirEl.textContent = targetPath;
    cPanelApp.openModal('modal-fm-indices');
  },

  async submitIndices() {
    const dir = document.getElementById('indices-dir-name').textContent.trim();
    const checked = document.querySelector('input[name="indices-mode"]:checked');
    const mode = checked ? checked.value : 'default';

    try {
      await cPanelApp.api('/api/files/manage-indices', {
        method: 'POST',
        body: { dir, mode }
      });
      cPanelApp.closeModal('modal-fm-indices');
      cPanelApp.showToast(`Index browsing set to ${mode} for "${dir}"!`, 'success');
      await this.navigateTo(this.currentPath);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // Aliases for toolbar button compatibility
  promptMove() { this.openMoveModal(); },
  promptCopy() { this.openCopyModal(); },
  promptRename() { this.openRenameModal(); },
  promptChmod() { this.openPermissionsModal(); },
  promptDelete() { this.openDeleteModal(); },
  promptCompress() { this.openCompressModal(); },
  promptExtract() { this.openExtractModal(); },

  downloadSelected() {
    if (!this.selectedItem || this.selectedItem.isDir) return;
    window.location.href = `/api/files/download?path=${encodeURIComponent(this.selectedItem.path)}`;
  },

  navigateUp() {
    if (this.currentPath === '/') return;
    const parent = this.currentPath.split('/').slice(0, -1).join('/') || '/';
    this.navigateTo(parent);
  },

  // ========================================================================
  // Authentic cPanel Character Encoding Confirmation Dialog & Editor Opener
  // ========================================================================
  openEditConfirmModal(filePath) {
    const cleanPath = filePath || (this.selectedItem ? this.selectedItem.path : null);
    if (!cleanPath) return;

    if (this.isImageFile(cleanPath)) {
      this.openImageViewer(cleanPath);
      return;
    }
    if (this.isBinaryFile(cleanPath)) {
      cPanelApp.showToast('Binary files cannot be opened in Code Editor. Please use Download or View.', 'error');
      return;
    }

    // Check if user disabled encoding check
    if (localStorage.getItem('cpanel_disable_encoding_check') === 'true') {
      this.launchEditorTab(cleanPath, 'utf-8');
      return;
    }

    this.pendingEditFile = cleanPath;
    const pathEl = document.getElementById('fm-edit-confirm-path');
    if (pathEl) pathEl.textContent = cleanPath;

    const encSelect = document.getElementById('fm-edit-confirm-encoding');
    if (encSelect) encSelect.value = 'utf-8';

    cPanelApp.openModal('modal-fm-edit-confirm');
  },

  proceedToEditor() {
    const targetPath = this.pendingEditFile || (this.selectedItem ? this.selectedItem.path : null);
    if (!targetPath) {
      cPanelApp.showToast('No file selected for editing', 'warning');
      return;
    }
    const encSelect = document.getElementById('fm-edit-confirm-encoding');
    const encoding = encSelect ? encSelect.value : 'utf-8';

    cPanelApp.closeModal('modal-fm-edit-confirm');
    this.launchEditorTab(targetPath, encoding);
  },

  disableEncodingCheck() {
    localStorage.setItem('cpanel_disable_encoding_check', 'true');
    cPanelApp.showToast('Encoding check disabled for future edits. (Click Edit to proceed).', 'info');
  },

  launchEditorTab(filePath, encoding = 'utf-8') {
    const url = `/editor.html?file=${encodeURIComponent(filePath)}&encoding=${encodeURIComponent(encoding)}`;
    window.open(url, '_blank');
  },

  // Backward compatibility alias
  openCodeEditor(filePath) {
    this.openEditConfirmModal(filePath);
  },

  // Image Viewer & Preview Modal
  openImageViewer(filePath) {
    const cleanPath = filePath || (this.selectedItem ? this.selectedItem.path : null);
    if (!cleanPath) return;

    const filename = cleanPath.split('/').pop();
    const titleEl = document.getElementById('viewer-image-title');
    const infoEl = document.getElementById('viewer-image-info');
    const dimsEl = document.getElementById('viewer-image-dims');
    const imgEl = document.getElementById('viewer-image-img');

    this.currentZoom = 1.0;
    this.currentImageItem = cleanPath;

    if (titleEl) titleEl.textContent = filename;
    if (infoEl) infoEl.textContent = `Location: ${cleanPath}`;
    if (dimsEl) dimsEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';

    if (imgEl) {
      imgEl.style.transform = 'scale(1)';
      imgEl.onload = () => {
        if (dimsEl) {
          dimsEl.textContent = `${imgEl.naturalWidth} x ${imgEl.naturalHeight} px`;
        }
      };
      imgEl.onerror = () => {
        if (dimsEl) {
          dimsEl.textContent = 'Error loading preview';
        }
      };
      imgEl.src = `/api/files/download?path=${encodeURIComponent(cleanPath)}&inline=true&t=${Date.now()}`;
    }

    const resetBtn = document.getElementById('btn-zoom-reset');
    if (resetBtn) resetBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> 100%';

    cPanelApp.openModal('modal-image-viewer');
  },

  zoomIn() {
    this.currentZoom = Math.min(+(this.currentZoom + 0.25).toFixed(2), 4.0);
    this.applyZoom();
  },

  zoomOut() {
    this.currentZoom = Math.max(+(this.currentZoom - 0.25).toFixed(2), 0.25);
    this.applyZoom();
  },

  resetZoom() {
    this.currentZoom = 1.0;
    this.applyZoom();
  },

  applyZoom() {
    const imgEl = document.getElementById('viewer-image-img');
    const resetBtn = document.getElementById('btn-zoom-reset');
    if (imgEl) {
      imgEl.style.transform = `scale(${this.currentZoom})`;
    }
    if (resetBtn) {
      resetBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> ${Math.round(this.currentZoom * 100)}%`;
    }
  },

  downloadImage() {
    const target = this.currentImageItem || (this.selectedItem ? this.selectedItem.path : null);
    if (!target) return;
    window.location.href = `/api/files/download?path=${encodeURIComponent(target)}`;
  },

  async saveCodeEditor() {
    if (!this.activeEditingFile) return;
    const content = document.getElementById('editor-textarea').value;

    try {
      await cPanelApp.api('/api/files/save', {
        method: 'POST',
        body: { path: this.activeEditingFile, content }
      });
      cPanelApp.showToast('File saved successfully!', 'success');
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // Zip Compress
  async promptCompress() {
    if (!this.selectedItem) return;
    const defaultZip = `${this.selectedItem.name}.zip`;
    const zipName = prompt('Enter archive name:', defaultZip);
    if (!zipName) return;

    try {
      await cPanelApp.api('/api/files/compress', {
        method: 'POST',
        body: {
          items: [this.selectedItem.path],
          zipName,
          destinationDir: this.currentPath
        }
      });
      cPanelApp.showToast(`Compressed into "${zipName}"!`, 'success');
      await this.navigateTo(this.currentPath);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },



  // Upload Modal
  openUploadModal() {
    document.getElementById('upload-target-path').textContent = this.currentPath;
    document.getElementById('upload-file-input').value = '';
    document.getElementById('upload-progress-bar').style.width = '0%';
    document.getElementById('upload-status-text').textContent = 'Drag files here or click Choose Files';
    cPanelApp.openModal('modal-upload');
  },

  async handleUploadSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('upload-file-input');
    if (!input.files || input.files.length === 0) {
      cPanelApp.showToast('Please select at least one file to upload.', 'error');
      return;
    }

    const formData = new FormData();
    for (const f of input.files) {
      formData.append('files', f);
    }

    const progressBar = document.getElementById('upload-progress-bar');
    const statusText = document.getElementById('upload-status-text');
    statusText.textContent = `Uploading ${input.files.length} file(s)...`;
    progressBar.style.width = '50%';

    try {
      const res = await fetch(`/api/files/upload?dir=${encodeURIComponent(this.currentPath)}`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': cPanelApp.csrfToken },
        body: formData
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();

      progressBar.style.width = '100%';
      statusText.textContent = `Upload Complete! (${data.count} files)`;
      cPanelApp.showToast(`Uploaded ${data.count} file(s) successfully!`, 'success');

      setTimeout(() => {
        cPanelApp.closeModal('modal-upload');
        this.navigateTo(this.currentPath);
      }, 800);

    } catch (err) {
      statusText.textContent = `Error: ${err.message}`;
      cPanelApp.showToast(err.message, 'error');
    }
  },

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  setupListeners() {
    // Toolbar buttons
    const btnNewFile = document.getElementById('fm-btn-new-file');
    if (btnNewFile) btnNewFile.onclick = () => this.promptNewFile();

    const btnNewFolder = document.getElementById('fm-btn-new-folder');
    if (btnNewFolder) btnNewFolder.onclick = () => this.promptNewFolder();

    const btnRename = document.getElementById('fm-btn-rename');
    if (btnRename) btnRename.onclick = () => this.promptRename();

    const btnDelete = document.getElementById('fm-btn-delete');
    if (btnDelete) btnDelete.onclick = () => this.promptDelete();

    const btnDownload = document.getElementById('fm-btn-download');
    if (btnDownload) btnDownload.onclick = () => this.downloadSelected();

    const btnView = document.getElementById('fm-btn-view');
    if (btnView) btnView.onclick = () => {
      if (!this.selectedItem || this.selectedItem.isDir) return;
      if (this.isImageFile(this.selectedItem.path)) {
        this.openImageViewer(this.selectedItem.path);
      } else {
        this.openReadOnlyViewer(this.selectedItem.path);
      }
    };

    const btnEdit = document.getElementById('fm-btn-edit');
    if (btnEdit) btnEdit.onclick = () => {
      if (!this.selectedItem || this.selectedItem.isDir) return;
      this.openEditConfirmModal(this.selectedItem.path);
    };

    const btnCompress = document.getElementById('fm-btn-compress');
    if (btnCompress) btnCompress.onclick = () => this.promptCompress();

    const btnExtract = document.getElementById('fm-btn-extract');
    if (btnExtract) btnExtract.onclick = () => this.promptExtract();

    const btnUpload = document.getElementById('fm-btn-upload');
    if (btnUpload) btnUpload.onclick = () => this.openUploadModal();

    const btnReload = document.getElementById('fm-btn-reload');
    if (btnReload) btnReload.onclick = () => this.navigateTo(this.currentPath);

    const btnUp = document.getElementById('fm-btn-up');
    if (btnUp) btnUp.onclick = () => {
      if (this.currentPath === '/') return;
      const parent = this.currentPath.split('/').slice(0, -1).join('/') || '/';
      this.navigateTo(parent);
    };

    // Code Editor Save
    const btnSaveEditor = document.getElementById('btn-save-code');
    if (btnSaveEditor) btnSaveEditor.onclick = () => this.saveCodeEditor();

    // Upload Form
    const uploadForm = document.getElementById('form-upload-files');
    if (uploadForm) uploadForm.onsubmit = (e) => this.handleUploadSubmit(e);

    // Image Viewer Controls
    const btnZoomIn = document.getElementById('btn-zoom-in');
    if (btnZoomIn) btnZoomIn.onclick = () => this.zoomIn();

    const btnZoomOut = document.getElementById('btn-zoom-out');
    if (btnZoomOut) btnZoomOut.onclick = () => this.zoomOut();

    const btnZoomReset = document.getElementById('btn-zoom-reset');
    if (btnZoomReset) btnZoomReset.onclick = () => this.resetZoom();

    const btnViewerDl = document.getElementById('btn-viewer-download');
    if (btnViewerDl) btnViewerDl.onclick = () => this.downloadImage();
  }
};

window.fileManager = fileManager;
document.addEventListener('DOMContentLoaded', () => fileManager.init());
