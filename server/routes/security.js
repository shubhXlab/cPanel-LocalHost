const express = require('express');
const router = express.Router();
const securityService = require('../services/securityService');

// --- SSL / TLS Status Endpoints ---

// Get SSL status for all configured domains
router.get('/ssl', (req, res) => {
  try {
    const list = securityService.getSSLStatus();
    res.json({ success: true, domains: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run AutoSSL for a specific domain
router.post('/ssl/autossl', async (req, res) => {
  const { domain } = req.body;
  if (!domain) {
    return res.status(400).json({ error: 'Domain name is required' });
  }
  try {
    const result = await securityService.runAutoSSL(domain);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run AutoSSL for all domains
router.post('/ssl/autossl-all', async (req, res) => {
  try {
    const domains = securityService.getSSLStatus();
    const results = [];
    for (const d of domains) {
      try {
        const r = await securityService.runAutoSSL(d.domain);
        results.push(r);
      } catch (err) {
        results.push({ domain: d.domain, error: err.message });
      }
    }
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inspect specific certificate details
router.get('/ssl/cert', (req, res) => {
  const domain = req.query.domain;
  if (!domain) {
    return res.status(400).json({ error: 'Domain parameter is required' });
  }
  try {
    const certDetails = securityService.getCertificateDetails(domain);
    res.json({ success: true, certificate: certDetails });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// --- IP Blocker Endpoints ---

// List all currently blocked IP addresses / CIDR ranges
router.get('/ip-blocker', (req, res) => {
  try {
    const list = securityService.getBlockedIPs();
    res.json({ success: true, blockedIps: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add an IP or CIDR range to block
router.post('/ip-blocker', (req, res) => {
  const { ip, comment } = req.body;
  if (!ip) {
    return res.status(400).json({ error: 'IP address or CIDR range is required' });
  }
  try {
    const item = securityService.addBlockedIP({ ip, comment });
    res.status(201).json({ success: true, item, message: `IP ${item.ip} blocked in .htaccess` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Remove a blocked IP / unblock
router.delete('/ip-blocker/:id', (req, res) => {
  try {
    const result = securityService.removeBlockedIP(req.params.id);
    res.json({ success: true, message: 'IP unblocked successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
