const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fileService = require('../services/fileService');
const panelDb = require('../database/panelDb');

// Configure Multer for file uploads into target directory
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const targetDir = req.query.dir || '/';
    try {
      // Resolve path safely through fileService chroot jail
      const fullDir = fileService.resolveSafePath(targetDir);
      cb(null, fullDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB max upload
});

// List files in directory
router.get('/list', async (req, res) => {
  const dirPath = req.query.path || '/';
  try {
    const data = await fileService.list(dirPath);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Read file for Code Editor
router.get('/read', async (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'File path required' });

  try {
    const fileData = await fileService.readFile(filePath);
    res.json(fileData);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Save file content
router.post('/save', async (req, res) => {
  const { path: filePath, content, encoding } = req.body;
  if (!filePath) return res.status(400).json({ error: 'File path required' });

  try {
    const result = await fileService.saveFile(filePath, content || '', encoding);
    panelDb.logAction('EDIT_FILE', `Edited file: ${filePath}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create new file
router.post('/create-file', async (req, res) => {
  const { dir, name } = req.body;
  try {
    const result = await fileService.createFile(dir || '/', name);
    panelDb.logAction('CREATE_FILE', `Created file: ${name} in ${dir}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create new folder
router.post('/create-folder', async (req, res) => {
  const { dir, name } = req.body;
  try {
    const result = await fileService.createFolder(dir || '/', name);
    panelDb.logAction('CREATE_FOLDER', `Created directory: ${name} in ${dir}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Rename item
router.post('/rename', async (req, res) => {
  const { path: oldPath, newName } = req.body;
  try {
    const result = await fileService.rename(oldPath, newName);
    panelDb.logAction('RENAME_FILE', `Renamed ${oldPath} to ${newName}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Copy item
router.post('/copy', async (req, res) => {
  const { path: srcPath, destDir } = req.body;
  try {
    const result = await fileService.copyItem(srcPath, destDir || '/');
    panelDb.logAction('COPY_FILE', `Copied ${srcPath} to ${destDir}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Move item
router.post('/move', async (req, res) => {
  const { path: srcPath, destDir } = req.body;
  try {
    const result = await fileService.moveItem(srcPath, destDir || '/');
    panelDb.logAction('MOVE_FILE', `Moved ${srcPath} to ${destDir}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Change permissions (chmod)
router.post('/chmod', async (req, res) => {
  const { path: itemPath, mode } = req.body;
  try {
    const result = await fileService.chmod(itemPath, mode);
    panelDb.logAction('CHMOD_FILE', `Changed permissions on ${itemPath} to ${mode}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete item
router.post('/delete', async (req, res) => {
  const { path: itemPath } = req.body;
  try {
    const result = await fileService.deleteItem(itemPath);
    panelDb.logAction('DELETE_FILE', `Deleted: ${itemPath}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Compress items
router.post('/compress', async (req, res) => {
  const { items, zipName, destinationDir } = req.body;
  try {
    const result = await fileService.compress(items, zipName, destinationDir);
    panelDb.logAction('COMPRESS_FILES', `Compressed ${items.length} items to ${zipName}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Extract archive
router.post('/extract', async (req, res) => {
  const { zipPath, targetDir } = req.body;
  try {
    const result = await fileService.extract(zipPath, targetDir);
    panelDb.logAction('EXTRACT_ARCHIVE', `Extracted ${zipPath} to ${targetDir}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Password Protect Directory
router.post('/protect-dir', async (req, res) => {
  const { dir, authName, username, password, enabled } = req.body;
  try {
    const result = await fileService.protectDirectory(dir, authName, username, password, enabled);
    panelDb.logAction('PROTECT_DIR', `Configured directory privacy for ${dir}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Manage Directory Indices
router.post('/manage-indices', async (req, res) => {
  const { dir, mode } = req.body;
  try {
    const result = await fileService.setIndices(dir, mode);
    panelDb.logAction('MANAGE_INDICES', `Configured index browsing (${mode}) for ${dir}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Leech Protection
router.post('/leech-protect', async (req, res) => {
  const { dir, maxLogins, redirectUrl, disableCompromised } = req.body;
  try {
    const result = await fileService.setLeechProtect(dir, maxLogins, redirectUrl, disableCompromised);
    panelDb.logAction('LEECH_PROTECT', `Configured leech protection for ${dir}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Download or stream file
router.get('/download', (req, res) => {
  const filePath = req.query.path;
  const inline = req.query.inline === 'true';
  try {
    const physicalPath = fileService.getDownloadPath(filePath);
    if (inline) {
      return res.sendFile(physicalPath);
    }
    res.download(physicalPath);
  } catch (err) {
    res.status(404).send('File not found');
  }
});

// Upload files
router.post('/upload', upload.array('files', 20), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files were uploaded.' });
  }

  panelDb.logAction('UPLOAD_FILES', `Uploaded ${req.files.length} file(s)`, req.user ? req.user.id : 'system', req.ip);
  res.json({
    success: true,
    count: req.files.length,
    files: req.files.map(f => f.originalname)
  });
});

module.exports = router;
