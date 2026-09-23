const express = require('express');
const router = express.Router();
const path = require('path');
const backupService = require('../services/backupService');
const panelDb = require('../database/panelDb');
const config = require('../config');

// List backups
router.get('/', async (req, res) => {
  try {
    const backups = await backupService.listBackups();
    res.json({ backups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create full backup
router.post('/create', async (req, res) => {
  try {
    const backup = await backupService.createFullBackup();
    panelDb.logAction('CREATE_BACKUP', `Created full cPanel backup: ${backup.fileName}`, req.user ? req.user.id : 'system', req.ip);
    res.json(backup);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download backup file
router.get('/download/:filename', (req, res) => {
  const { filename } = req.params;
  const cleanName = path.basename(filename);
  const fullPath = path.join(config.backupsDir, cleanName);

  res.download(fullPath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).send('Backup archive not found');
    }
  });
});

module.exports = router;
