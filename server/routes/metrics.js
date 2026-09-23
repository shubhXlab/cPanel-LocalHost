const express = require('express');
const router = express.Router();
const sysinfoService = require('../services/sysinfoService');
const panelDb = require('../database/panelDb');

// Get live resource statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await sysinfoService.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get detailed disk usage breakdown
router.get('/disk-usage', async (req, res) => {
  try {
    const diskUsage = await sysinfoService.getDetailedDiskUsage();
    res.json(diskUsage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get real server specifications (Server Information tool)
router.get('/server-info', async (req, res) => {
  try {
    const info = await sysinfoService.getServerInfo();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get server logs
router.get('/logs', async (req, res) => {
  const { type, lines } = req.query;
  try {
    const logs = await sysinfoService.getLogs(type || 'all', parseInt(lines || '50', 10));
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1. Errors endpoint
router.get('/errors', async (req, res) => {
  const { source, lines, filter } = req.query;
  try {
    const data = await sysinfoService.getParsedErrors(source || 'apache', parseInt(lines || '100', 10), filter || '');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Raw Access endpoint
router.get('/raw-access', async (req, res) => {
  const { lines, filter } = req.query;
  try {
    const data = await sysinfoService.getRawAccessLogs(parseInt(lines || '100', 10), filter || '');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Resource Usage endpoint
router.get('/resource-usage', async (req, res) => {
  try {
    const data = await sysinfoService.getResourceUsage();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Visitors endpoint
router.get('/visitors', async (req, res) => {
  const { limit } = req.query;
  try {
    const data = await sysinfoService.getVisitors(parseInt(limit || '300', 10));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Download raw log file
router.get('/logs/download', (req, res) => {
  const { type } = req.query;
  const config = require('../config');
  let targetPath = config.xampp.apache.errorLog;
  let filename = 'apache_error_log.txt';

  if (type === 'access') {
    targetPath = config.xampp.apache.accessLog;
    filename = 'apache_access_log.txt';
  } else if (type === 'mysql') {
    targetPath = config.xampp.mysql.errorLog;
    filename = 'mysql_error_log.txt';
  }

  const fs = require('fs');
  if (fs.existsSync(targetPath)) {
    res.download(targetPath, filename);
  } else {
    res.status(404).send('Log file not found');
  }
});

// Get cPanel audit logs
router.get('/audit', (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  const logs = panelDb.getAuditLogs(limit);
  res.json({ logs });
});

module.exports = router;
