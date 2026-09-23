const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const config = require('../config');

// Safe root path: default to C:\xampp\htdocs
const ROOT_PATH = path.resolve(config.xampp.htdocs);

// Ensure ROOT_PATH exists
if (!fs.existsSync(ROOT_PATH)) {
  try {
    fs.mkdirSync(ROOT_PATH, { recursive: true });
  } catch (e) {}
}

// Chroot Jail / Path Normalization helper
function resolveSafePath(relativeSubPath = '') {
  // Replace backslashes, clean null bytes
  const sanitized = relativeSubPath.replace(/\0/g, '').replace(/\\/g, '/');
  // Combine with root
  const resolved = path.resolve(ROOT_PATH, sanitized.startsWith('/') ? sanitized.slice(1) : sanitized);

  // Security check: Must reside within ROOT_PATH
  if (!resolved.toLowerCase().startsWith(ROOT_PATH.toLowerCase())) {
    const err = new Error('Access Denied: Path traversal outside chroot jail is strictly prohibited.');
    err.code = 'EACCES_JAIL';
    throw err;
  }

  return resolved;
}

// Convert absolute to relative path for UI
function toRelativePath(absPath) {
  const rel = path.relative(ROOT_PATH, absPath).replace(/\\/g, '/');
  return rel === '' ? '/' : (rel.startsWith('/') ? rel : '/' + rel);
}

const fileService = {
  getRootPath() {
    return ROOT_PATH;
  },

  resolveSafePath(relPath = '') {
    return resolveSafePath(relPath);
  },

  // List folder contents
  async list(relPath = '/') {
    const targetDir = resolveSafePath(relPath);
    if (!fs.existsSync(targetDir)) {
      throw new Error(`Directory does not exist: ${relPath}`);
    }

    const stat = await fs.promises.stat(targetDir);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${relPath}`);
    }

    const entries = await fs.promises.readdir(targetDir, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      const fullPath = path.join(targetDir, entry.name);
      try {
        const itemStat = await fs.promises.stat(fullPath);
        const isDir = entry.isDirectory();
        const ext = path.extname(entry.name).toLowerCase();
        const mimeType = isDir ? 'directory' : (mime.lookup(entry.name) || 'application/octet-stream');

        items.push({
          name: entry.name,
          path: toRelativePath(fullPath),
          isDir,
          size: isDir ? 0 : itemStat.size,
          mtime: itemStat.mtime.toISOString(),
          permissions: (itemStat.mode & 0o777).toString(8),
          extension: ext,
          mime: mimeType
        });
      } catch (err) {
        // Skip unreadable files
      }
    }

    // Sort: directories first, then alphabetical
    items.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return {
      currentPath: toRelativePath(targetDir),
      items
    };
  },

  // Read file contents (for Code Editor)
  async readFile(relPath) {
    const fullPath = resolveSafePath(relPath);
    const stat = await fs.promises.stat(fullPath);
    if (stat.isDirectory()) {
      throw new Error('Cannot read a directory as text');
    }

    // Limit maximum edit size to 10MB to avoid freezing
    if (stat.size > 10 * 1024 * 1024) {
      throw new Error('File exceeds 10MB limit for web editor');
    }

    const ext = path.extname(fullPath).toLowerCase();
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.zip', '.tar', '.gz', '.rar', '.7z', '.exe', '.dll', '.pdf', '.mp3', '.mp4'];
    if (binaryExts.includes(ext)) {
      throw new Error(`Cannot open binary file (${ext}) in text editor. Please use the View or Download button.`);
    }

    const content = await fs.promises.readFile(fullPath, 'utf8');
    const mimeType = mime.lookup(fullPath) || 'text/plain';

    return {
      path: toRelativePath(fullPath),
      name: path.basename(fullPath),
      size: stat.size,
      mime: mimeType,
      content
    };
  },

  // Save file content
  async saveFile(relPath, content, encoding = 'utf8') {
    const fullPath = resolveSafePath(relPath);
    let enc = 'utf8';
    if (encoding) {
      const norm = String(encoding).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (['ascii', 'usascii'].includes(norm)) enc = 'ascii';
      else if (['latin1', 'iso88591', 'windows1252'].includes(norm)) enc = 'latin1';
      else enc = 'utf8';
    }
    await fs.promises.writeFile(fullPath, content, enc);
    return { success: true, path: toRelativePath(fullPath), encoding: enc };
  },

  // Create new file
  async createFile(dirRelPath, fileName) {
    const targetDir = resolveSafePath(dirRelPath);
    const cleanName = path.basename(fileName.trim());
    if (!cleanName) throw new Error('Filename cannot be empty');

    const fullPath = path.join(targetDir, cleanName);
    // Path jail check
    resolveSafePath(toRelativePath(fullPath));

    if (fs.existsSync(fullPath)) {
      throw new Error(`File already exists: ${cleanName}`);
    }

    await fs.promises.writeFile(fullPath, '', 'utf8');
    return { success: true, path: toRelativePath(fullPath), name: cleanName };
  },

  // Create new directory
  async createFolder(dirRelPath, folderName) {
    const targetDir = resolveSafePath(dirRelPath);
    const cleanName = path.basename(folderName.trim());
    if (!cleanName) throw new Error('Folder name cannot be empty');

    const fullPath = path.join(targetDir, cleanName);
    resolveSafePath(toRelativePath(fullPath));

    if (fs.existsSync(fullPath)) {
      throw new Error(`Folder already exists: ${cleanName}`);
    }

    await fs.promises.mkdir(fullPath, { recursive: true });
    return { success: true, path: toRelativePath(fullPath), name: cleanName };
  },

  // Rename item
  async rename(oldRelPath, newName) {
    const oldPath = resolveSafePath(oldRelPath);
    if (!fs.existsSync(oldPath)) throw new Error('Source item does not exist');

    const cleanName = path.basename(newName.trim());
    const newPath = path.join(path.dirname(oldPath), cleanName);
    resolveSafePath(toRelativePath(newPath));

    if (fs.existsSync(newPath)) throw new Error(`An item named "${cleanName}" already exists`);

    await fs.promises.rename(oldPath, newPath);
    return { success: true, oldPath: toRelativePath(oldPath), newPath: toRelativePath(newPath) };
  },

  // Delete item
  async deleteItem(relPath) {
    const fullPath = resolveSafePath(relPath);
    if (!fs.existsSync(fullPath)) throw new Error('Item does not exist');

    const stat = await fs.promises.stat(fullPath);
    if (stat.isDirectory()) {
      await fs.promises.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(fullPath);
    }
    return { success: true, path: toRelativePath(fullPath) };
  },

  // Copy item
  async copyItem(srcRelPath, destDirRel = '/') {
    const srcPath = resolveSafePath(srcRelPath);
    if (!fs.existsSync(srcPath)) throw new Error('Source item does not exist');

    const destDir = resolveSafePath(destDirRel);
    if (!fs.existsSync(destDir)) throw new Error('Destination directory does not exist');

    const itemName = path.basename(srcPath);
    let targetPath = path.join(destDir, itemName);
    if (fs.existsSync(targetPath)) {
      const ext = path.extname(itemName);
      const base = path.basename(itemName, ext);
      targetPath = path.join(destDir, `${base}-copy${ext}`);
    }
    resolveSafePath(toRelativePath(targetPath));

    await fs.promises.cp(srcPath, targetPath, { recursive: true });
    return {
      success: true,
      srcPath: toRelativePath(srcPath),
      destPath: toRelativePath(targetPath),
      name: path.basename(targetPath)
    };
  },

  // Move item
  async moveItem(srcRelPath, destDirRel = '/') {
    const srcPath = resolveSafePath(srcRelPath);
    if (!fs.existsSync(srcPath)) throw new Error('Source item does not exist');

    const destDir = resolveSafePath(destDirRel);
    if (!fs.existsSync(destDir)) throw new Error('Destination directory does not exist');

    const itemName = path.basename(srcPath);
    const targetPath = path.join(destDir, itemName);
    resolveSafePath(toRelativePath(targetPath));

    if (fs.existsSync(targetPath)) {
      throw new Error(`An item named "${itemName}" already exists in the destination folder`);
    }

    try {
      await fs.promises.rename(srcPath, targetPath);
    } catch (err) {
      await fs.promises.cp(srcPath, targetPath, { recursive: true });
      const stat = await fs.promises.stat(srcPath);
      if (stat.isDirectory()) {
        await fs.promises.rm(srcPath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(srcPath);
      }
    }

    return {
      success: true,
      srcPath: toRelativePath(srcPath),
      destPath: toRelativePath(targetPath),
      name: itemName
    };
  },

  // Change permissions (chmod)
  async chmod(relPath, mode) {
    const fullPath = resolveSafePath(relPath);
    if (!fs.existsSync(fullPath)) throw new Error('Item does not exist');

    let parsedMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
    if (isNaN(parsedMode)) {
      throw new Error('Invalid permission format. Expected octal notation like 0644 or 0755.');
    }

    try {
      await fs.promises.chmod(fullPath, parsedMode);
    } catch (e) {
      // Windows filesystem handles read-only flags differently
    }

    const stat = await fs.promises.stat(fullPath);
    return {
      success: true,
      path: toRelativePath(fullPath),
      permissions: (stat.mode & 0o777).toString(8)
    };
  },

  // Compress items into Zip
  async compress(items, zipName, destinationDir = '/') {
    const destDir = resolveSafePath(destinationDir);
    const cleanZipName = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`;
    const zipPath = path.join(destDir, cleanZipName);
    resolveSafePath(toRelativePath(zipPath));

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        resolve({
          success: true,
          zipPath: toRelativePath(zipPath),
          totalBytes: archive.pointer()
        });
      });

      archive.on('error', (err) => reject(err));
      archive.pipe(output);

      for (const itemRelPath of items) {
        const itemFull = resolveSafePath(itemRelPath);
        const itemName = path.basename(itemFull);
        const stat = fs.statSync(itemFull);

        if (stat.isDirectory()) {
          archive.directory(itemFull, itemName);
        } else {
          archive.file(itemFull, { name: itemName });
        }
      }

      archive.finalize();
    });
  },

  // Extract Zip
  async extract(zipRelPath, targetDirRel = '/') {
    const zipFullPath = resolveSafePath(zipRelPath);
    const destFullPath = resolveSafePath(targetDirRel);

    if (!fs.existsSync(zipFullPath)) throw new Error('Zip archive not found');

    const zip = new AdmZip(zipFullPath);
    zip.extractAllTo(destFullPath, true);

    return { success: true, extractedTo: toRelativePath(destFullPath) };
  },

  // Get physical file for download
  getDownloadPath(relPath) {
    const fullPath = resolveSafePath(relPath);
    if (!fs.existsSync(fullPath)) throw new Error('File does not exist');
    return fullPath;
  },

  // Password Protect / Directory Privacy
  async protectDirectory(dirRel, authName, username, password, enabled = true) {
    const fullDir = resolveSafePath(dirRel);
    if (!fs.existsSync(fullDir)) throw new Error('Directory does not exist');

    const htaccessPath = path.join(fullDir, '.htaccess');
    const passDir = path.join(ROOT_PATH, '.htpasswds');
    if (!fs.existsSync(passDir)) {
      try { fs.mkdirSync(passDir, { recursive: true }); } catch (e) {}
    }
    const htpasswdFile = path.join(passDir, '.htpasswd').replace(/\\/g, '/');

    if (username && password) {
      fs.appendFileSync(path.join(passDir, '.htpasswd'), `${username}:{SHA}${Buffer.from(password).toString('base64')}\n`, 'utf8');
    }

    let htaccessContent = fs.existsSync(htaccessPath) ? fs.readFileSync(htaccessPath, 'utf8') : '';
    htaccessContent = htaccessContent.replace(/# BEGIN cPanel Directory Privacy[\s\S]*?# END cPanel Directory Privacy\n?/g, '');

    if (enabled) {
      const block = `# BEGIN cPanel Directory Privacy\nAuthType Basic\nAuthName "${authName || 'Restricted Area'}"\nAuthUserFile "${htpasswdFile}"\nRequire valid-user\n# END cPanel Directory Privacy\n`;
      htaccessContent = block + htaccessContent;
    }

    fs.writeFileSync(htaccessPath, htaccessContent.trim() + '\n', 'utf8');
    return { success: true, dir: toRelativePath(fullDir), enabled, authName };
  },

  // Set Directory Indices
  async setIndices(dirRel, mode = 'default') {
    const fullDir = resolveSafePath(dirRel);
    if (!fs.existsSync(fullDir)) throw new Error('Directory does not exist');

    const htaccessPath = path.join(fullDir, '.htaccess');
    let htaccessContent = fs.existsSync(htaccessPath) ? fs.readFileSync(htaccessPath, 'utf8') : '';
    htaccessContent = htaccessContent.replace(/# BEGIN cPanel Index Manager[\s\S]*?# END cPanel Index Manager\n?/g, '');

    let directive = '';
    if (mode === 'none') {
      directive = 'Options -Indexes';
    } else if (mode === 'standard') {
      directive = 'Options +Indexes';
    } else if (mode === 'fancy') {
      directive = 'Options +Indexes +FancyIndexing';
    }

    if (directive) {
      const block = `# BEGIN cPanel Index Manager\n${directive}\n# END cPanel Index Manager\n`;
      htaccessContent = block + htaccessContent;
    }

    fs.writeFileSync(htaccessPath, htaccessContent.trim() + '\n', 'utf8');
    return { success: true, dir: toRelativePath(fullDir), mode };
  },

  // Leech Protection
  async setLeechProtect(dirRel, maxLogins = 4, redirectUrl = '', disableCompromised = true) {
    const fullDir = resolveSafePath(dirRel);
    if (!fs.existsSync(fullDir)) throw new Error('Directory does not exist');

    const htaccessPath = path.join(fullDir, '.htaccess');
    let htaccessContent = fs.existsSync(htaccessPath) ? fs.readFileSync(htaccessPath, 'utf8') : '';
    htaccessContent = htaccessContent.replace(/# BEGIN cPanel Leech Protection[\s\S]*?# END cPanel Leech Protection\n?/g, '');

    const block = `# BEGIN cPanel Leech Protection\n# MaxLogins: ${maxLogins}\n# RedirectUrl: ${redirectUrl || 'http://localhost/leech_warning.html'}\n# DisableCompromised: ${disableCompromised}\n# END cPanel Leech Protection\n`;
    htaccessContent = block + htaccessContent;

    fs.writeFileSync(htaccessPath, htaccessContent.trim() + '\n', 'utf8');
    return { success: true, dir: toRelativePath(fullDir), maxLogins, redirectUrl };
  }
};

module.exports = fileService;
