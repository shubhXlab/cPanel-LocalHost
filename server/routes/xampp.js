const express = require('express');
const router = express.Router();
const xamppService = require('../services/xamppService');
const panelDb = require('../database/panelDb');

// Get overall XAMPP services status
router.get('/status', async (req, res) => {
  try {
    const status = await xamppService.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MySQL controls
router.post('/mysql/start', async (req, res) => {
  try {
    const result = await xamppService.startMySQL();
    panelDb.logAction('MYSQL_START', 'Started XAMPP MySQL service', req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/mysql/stop', async (req, res) => {
  try {
    const result = await xamppService.stopMySQL();
    panelDb.logAction('MYSQL_STOP', 'Stopped XAMPP MySQL service', req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/mysql/restart', async (req, res) => {
  try {
    const result = await xamppService.restartMySQL();
    panelDb.logAction('MYSQL_RESTART', 'Restarted XAMPP MySQL service', req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Apache controls
router.post('/apache/start', async (req, res) => {
  try {
    const result = await xamppService.startApache();
    panelDb.logAction('APACHE_START', 'Started XAMPP Apache service', req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/apache/stop', async (req, res) => {
  try {
    const result = await xamppService.stopApache();
    panelDb.logAction('APACHE_STOP', 'Stopped XAMPP Apache service', req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/apache/restart', async (req, res) => {
  try {
    const result = await xamppService.restartApache();
    panelDb.logAction('APACHE_RESTART', 'Restarted XAMPP Apache service', req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Versions info
router.get('/versions', async (req, res) => {
  try {
    const versions = await xamppService.getVersions();
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
