const express = require('express');
const router = express.Router();
const advancedService = require('../services/advancedService');
const panelDb = require('../database/panelDb');

// =========================================================================
// 1. Cron Jobs Endpoints
// =========================================================================

// List cron jobs
router.get('/cron', (req, res) => {
  try {
    const list = advancedService.getCronJobs();
    res.json({ success: true, cronJobs: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add cron job
router.post('/cron', (req, res) => {
  try {
    const job = advancedService.addCronJob(req.body);
    panelDb.logAction('CREATE_CRON', `Scheduled cron job: ${job.command}`, req.user ? req.user.id : 'system', req.ip);
    res.status(201).json({ success: true, job, message: 'Cron job scheduled successfully.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete cron job
router.delete('/cron/:id', (req, res) => {
  try {
    const result = advancedService.deleteCronJob(req.params.id);
    panelDb.logAction('DELETE_CRON', `Removed cron job ID ${req.params.id}`, req.user ? req.user.id : 'system', req.ip);
    res.json({ success: true, message: 'Cron job removed successfully.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Toggle cron job active status
router.post('/cron/:id/toggle', (req, res) => {
  try {
    const updated = advancedService.toggleCronJob(req.params.id);
    res.json({ success: true, job: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Run cron job now (test run)
router.post('/cron/:id/run', async (req, res) => {
  try {
    const result = await advancedService.runCronJobNow(req.params.id);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 2. Error Pages Endpoints
// =========================================================================

// List error pages
router.get('/error-pages', (req, res) => {
  try {
    const pages = advancedService.getErrorPages();
    res.json({ success: true, pages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get content of specific error page
router.get('/error-pages/:code', (req, res) => {
  try {
    const content = advancedService.getErrorPageContent(req.params.code);
    res.json({ success: true, code: req.params.code, content });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Save custom error page content
router.post('/error-pages/:code', (req, res) => {
  const { content, enabled } = req.body;
  try {
    const saved = advancedService.saveErrorPage({
      code: req.params.code,
      content,
      enabled: enabled !== false
    });
    panelDb.logAction('UPDATE_ERROR_PAGE', `Saved custom error page ${req.params.code}.html`, req.user ? req.user.id : 'system', req.ip);
    res.json({ success: true, page: saved, message: `Custom ${req.params.code}.html saved and active in .htaccess` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =========================================================================
// 3. Track DNS Endpoints
// =========================================================================

// DNS record lookup (dig / nslookup)
router.post('/dns/lookup', async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  try {
    const lookup = await advancedService.lookupDns(domain);
    res.json({ success: true, lookup });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Run Ping test
router.post('/dns/ping', async (req, res) => {
  const { host } = req.body;
  try {
    const ping = await advancedService.runPing(host);
    res.json({ success: true, ping });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run Traceroute diagnostic
router.post('/dns/traceroute', async (req, res) => {
  const { host } = req.body;
  try {
    const trace = await advancedService.runTraceRoute(host);
    res.json({ success: true, trace });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Windows hosts file info
router.get('/dns/hosts', (req, res) => {
  try {
    const hosts = advancedService.getHostsFileInfo();
    res.json({ success: true, hosts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
