// ==========================================================================
// cPanel Authentic Right-Click File Context Menu
// Intercepts right-click ONLY on files and folders in File Manager;
// leaves all other native browser right-clicks completely default and enabled.
// ==========================================================================

const cPanelContextMenu = {
  menuEl: null,

  init() {
    this.createMenuElement();
    this.bindEvents();
  },

  createMenuElement() {
    if (document.getElementById('cp-context-menu')) {
      this.menuEl = document.getElementById('cp-context-menu');
      return;
    }

    const el = document.createElement('div');
    el.id = 'cp-context-menu';
    el.className = 'cp-context-menu';
    document.body.appendChild(el);
    this.menuEl = el;
  },

  bindEvents() {
    // Only intercept right-click on files/folders
    document.addEventListener('contextmenu', (e) => {
      this.handleContextMenu(e);
    });

    // Dismiss context menu on click anywhere
    document.addEventListener('click', (e) => {
      if (this.menuEl && !this.menuEl.contains(e.target)) {
        this.hide();
      }
    });

    // Dismiss on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    });

    // Dismiss on window resize or scroll
    window.addEventListener('resize', () => this.hide());
    window.addEventListener('scroll', () => this.hide(), true);
  },

  handleContextMenu(e) {
    const target = e.target;

    // Check if right-clicked on a file/folder row in File Manager
    const fileRow = target.closest('.file-row');
    if (fileRow && window.fileManager) {
      e.preventDefault();
      e.stopPropagation();

      const encodedPath = fileRow.getAttribute('data-path');
      const isDir = fileRow.getAttribute('data-isdir') === 'true';
      const itemPath = decodeURIComponent(encodedPath);

      // Select item visually and set state
      window.fileManager.selectItem(fileRow, itemPath, isDir);

      this.showFileItemMenu(e, itemPath, isDir);
      return;
    }

    // Check if right-clicked on a folder in the File Manager tree panel
    const treeItem = target.closest('#fm-folder-tree div[onclick*="navigateTo"]');
    if (treeItem && window.fileManager) {
      e.preventDefault();
      e.stopPropagation();

      const match = treeItem.getAttribute('onclick').match(/navigateTo\('([^']+)'\)/);
      const folderPath = match ? match[1] : '/';
      this.showFileItemMenu(e, folderPath, true);
      return;
    }

    // For ALL other clicks anywhere on the page, native right-click is untouched
    this.hide();
  },

  showFileItemMenu(e, itemPath, isDir) {
    const itemName = itemPath.split('/').pop() || '/';
    const isZip = itemName.toLowerCase().endsWith('.zip');
    const isImage = window.fileManager ? window.fileManager.isImageFile(itemPath) : false;

    let items = [];

    if (!isDir) {
      // Independent File operations
      items.push({
        label: 'Download',
        icon: 'fa-solid fa-download',
        action: () => window.fileManager.downloadSelected()
      });

      if (isImage) {
        items.push({
          label: 'View',
          icon: 'fa-solid fa-eye',
          action: () => window.fileManager.openImageViewer(itemPath)
        });
      } else {
        items.push({
          label: 'View',
          icon: 'fa-solid fa-eye',
          action: () => window.fileManager.openReadOnlyViewer(itemPath)
        });
        // Single dedicated Edit action: prompts encoding confirmation and opens full editor
        items.push({
          label: 'Edit',
          icon: 'fa-solid fa-pen-to-square',
          action: () => window.fileManager.openEditConfirmModal(itemPath)
        });
      }
    }

    // Authentic cPanel Operations (matching user's screenshot layout):
    // Move, Copy, Rename, Change Permissions, Delete, Compress, Password Protect, Leech Protect, Manage Indices
    items.push({
      label: 'Move',
      icon: 'fa-solid fa-arrows-up-down-left-right',
      action: () => window.fileManager.openMoveModal()
    });

    items.push({
      label: 'Copy',
      icon: 'fa-regular fa-copy',
      action: () => window.fileManager.openCopyModal()
    });

    items.push({
      label: 'Rename',
      icon: 'fa-solid fa-file',
      action: () => window.fileManager.openRenameModal()
    });

    items.push({
      label: 'Change Permissions',
      icon: 'fa-solid fa-key',
      action: () => window.fileManager.openPermissionsModal()
    });

    items.push({
      label: 'Delete',
      icon: 'fa-solid fa-xmark',
      action: () => window.fileManager.openDeleteModal()
    });

    items.push({
      label: 'Compress',
      icon: 'fa-solid fa-compress',
      action: () => window.fileManager.openCompressModal()
    });

    if (!isDir && isZip) {
      items.push({
        label: 'Extract',
        icon: 'fa-solid fa-box-open',
        action: () => window.fileManager.openExtractModal()
      });
    }

    items.push({
      label: 'Password Protect',
      icon: 'fa-solid fa-lock',
      action: () => window.fileManager.openPrivacyModal()
    });

    items.push({
      label: 'Leech Protect',
      icon: 'fa-solid fa-shield-halved',
      action: () => window.fileManager.openLeechModal()
    });

    items.push({
      label: 'Manage Indices',
      icon: 'fa-solid fa-wrench',
      action: () => window.fileManager.openIndicesModal()
    });

    this.renderMenu(e, items);
  },

  renderMenu(e, items) {
    if (!this.menuEl) this.createMenuElement();

    let html = '';
    items.forEach((item, idx) => {
      html += `
        <div class="cp-context-item" data-index="${idx}">
          <i class="${item.icon}"></i>
          <span>${this.escapeHtml(item.label)}</span>
        </div>
      `;
    });

    this.menuEl.innerHTML = html;

    // Attach click listeners to items
    const renderedItems = this.menuEl.querySelectorAll('.cp-context-item');
    renderedItems.forEach(el => {
      const idx = parseInt(el.getAttribute('data-index'), 10);
      const itemConfig = items[idx];
      if (itemConfig && itemConfig.action) {
        el.onclick = (clickEvt) => {
          clickEvt.stopPropagation();
          this.hide();
          try {
            itemConfig.action();
          } catch (err) {
            console.error('Context menu action error:', err);
          }
        };
      }
    });

    // Position menu safely
    this.menuEl.style.display = 'flex';
    this.menuEl.classList.add('active');

    const menuWidth = this.menuEl.offsetWidth || 180;
    const menuHeight = this.menuEl.offsetHeight || 300;

    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > window.innerWidth) {
      posX = Math.max(5, window.innerWidth - menuWidth - 8);
    }
    if (posY + menuHeight > window.innerHeight) {
      posY = Math.max(5, window.innerHeight - menuHeight - 8);
    }

    this.menuEl.style.left = `${posX}px`;
    this.menuEl.style.top = `${posY}px`;
  },

  hide() {
    if (this.menuEl) {
      this.menuEl.classList.remove('active');
      this.menuEl.style.display = 'none';
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.cPanelContextMenu = cPanelContextMenu;
document.addEventListener('DOMContentLoaded', () => cPanelContextMenu.init());
