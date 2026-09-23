const express = require('express');
const router = express.Router();
const softwareService = require('../services/softwareService');
const panelDb = require('../database/panelDb');

// =========================================================================
// MultiPHP Manager Endpoints
// =========================================================================

// Get PHP Runtime Details & Extensions
router.get('/php', async (req, res) => {
  try {
    const details = await softwareService.getPhpDetails();
    res.json({ success: true, ...details });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List domains with their assigned PHP versions
router.get('/multiphp/domains', (req, res) => {
  try {
    const domains = softwareService.getDomainsPhp();
    res.json({ success: true, domains });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set domain PHP version & FPM
router.post('/multiphp/domains', (req, res) => {
  const { domain, phpVersion, fpmEnabled } = req.body;
  if (!domain) {
    return res.status(400).json({ error: 'Domain name is required' });
  }
  try {
    const updated = softwareService.setDomainPhp(domain, phpVersion, fpmEnabled);
    panelDb.logAction('UPDATE_DOMAIN_PHP', `Updated PHP version for ${domain} to ${phpVersion}`, req.user ? req.user.id : 'system', req.ip);
    res.json({ success: true, domain: updated, message: `Domain ${domain} configured with ${phpVersion || 'PHP 8.2 (System)'}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =========================================================================
// MultiPHP INI Editor Endpoints
// =========================================================================

// Get php.ini settings (structured & raw)
router.get('/php-ini', async (req, res) => {
  try {
    const settings = await softwareService.getPhpIniSettings();
    res.json({ success: true, ...settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update php.ini structured directives (Basic Mode)
router.post('/php-ini', async (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Settings object is required' });
  }
  try {
    const result = await softwareService.updatePhpIniSettings(settings);
    panelDb.logAction('UPDATE_PHP_INI', 'Modified core php.ini directives (Basic Mode)', req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Save raw php.ini content (Editor Mode)
router.post('/php-ini/raw', async (req, res) => {
  const { rawContent } = req.body;
  if (!rawContent || typeof rawContent !== 'string') {
    return res.status(400).json({ error: 'Raw php.ini content string is required' });
  }
  try {
    const result = await softwareService.saveRawPhpIni(rawContent);
    panelDb.logAction('UPDATE_PHP_INI_RAW', 'Saved raw php.ini configuration (Editor Mode)', req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =========================================================================
// Application Manager Endpoints
// =========================================================================

// List all registered web applications with health status
router.get('/apps', async (req, res) => {
  try {
    const apps = await softwareService.getApplications();
    res.json({ success: true, apps });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register a new application
router.post('/apps', (req, res) => {
  const { name, path, type, docRoot, url, env } = req.body;
  try {
    const app = softwareService.registerApplication({ name, path, type, docRoot, url, env });
    panelDb.logAction('REGISTER_APP', `Registered application ${name} at ${path}`, req.user ? req.user.id : 'system', req.ip);
    res.status(201).json({ success: true, app, message: `Application "${name}" registered successfully.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Unregister / delete an application
router.delete('/apps/:id', (req, res) => {
  try {
    const result = softwareService.deleteApplication(req.params.id);
    panelDb.logAction('DELETE_APP', `Unregistered application ID ${req.params.id}`, req.user ? req.user.id : 'system', req.ip);
    res.json({ success: true, message: 'Application unregistered successfully.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Check health of an application
router.post('/apps/:id/health', async (req, res) => {
  try {
    const health = await softwareService.checkAppHealth(req.params.id);
    res.json({ success: true, health });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
