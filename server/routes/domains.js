const express = require('express');
const router = express.Router();
const domainService = require('../services/domainService');
const panelDb = require('../database/panelDb');

// List domains
router.get('/', (req, res) => {
  const domains = domainService.getDomains();
  const hosts = domainService.getHostsFileGuidance();
  res.json({ domains, hosts });
});

// Auto-sync hosts file
router.post('/sync-hosts', async (req, res) => {
  try {
    const result = await domainService.syncHostsFile();
    panelDb.logAction('SYNC_HOSTS', 'Synchronized Windows hosts file with configured domains', req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add domain
router.post('/', async (req, res) => {
  const { domain, documentRoot, type } = req.body;
  try {
    const newDomain = await domainService.addDomain({ domain, documentRoot, type });
    panelDb.logAction('ADD_DOMAIN', `Added domain: ${domain}`, req.user ? req.user.id : 'system', req.ip);
    res.json({ success: true, domain: newDomain });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete domain
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await domainService.removeDomain(id);
    panelDb.logAction('DELETE_DOMAIN', `Deleted domain ID: ${id}`, req.user ? req.user.id : 'system', req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Hosts file instructions
router.get('/hosts', (req, res) => {
  const guidance = domainService.getHostsFileGuidance();
  res.json(guidance);
});

// --- Redirects Endpoints ---

// List redirects
router.get('/redirects', (req, res) => {
  try {
    const redirects = domainService.getRedirects();
    res.json({ redirects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add redirect
router.post('/redirects', async (req, res) => {
  try {
    const record = await domainService.addRedirect(req.body);
    panelDb.logAction('CREATE_REDIRECT', `Added redirect ${record.sourcePath} -> ${record.targetUrl}`, req.user ? req.user.id : 'system', req.ip);
    res.json({ success: true, redirect: record });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete redirect
router.delete('/redirects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await domainService.removeRedirect(id);
    panelDb.logAction('DELETE_REDIRECT', `Deleted redirect ID: ${id}`, req.user ? req.user.id : 'system', req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Zone Records Endpoints ---

// List zone records
router.get('/zone-records', (req, res) => {
  const domain = req.query.domain || null;
  try {
    const records = domainService.getZoneRecords(domain);
    res.json({ records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add zone record
router.post('/zone-records', async (req, res) => {
  try {
    const record = await domainService.addZoneRecord(req.body);
    panelDb.logAction('ADD_ZONE_RECORD', `Added DNS record ${record.name} (${record.type})`, req.user ? req.user.id : 'system', req.ip);
    res.json({ success: true, record });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete zone record
router.delete('/zone-records/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await domainService.removeZoneRecord(id);
    panelDb.logAction('DELETE_ZONE_RECORD', `Deleted DNS record ID: ${id}`, req.user ? req.user.id : 'system', req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
