const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const crypto = require('crypto');
const config = require('../config');
const panelDb = require('../database/panelDb');

const sslBaseDir = path.join(config.xampp.htdocs, 'ssl');
const certsDir = path.join(sslBaseDir, 'certs');
const keysDir = path.join(sslBaseDir, 'keys');
const htaccessPath = path.join(config.xampp.htdocs, 'public_html', '.htaccess');

function ensureDirectories() {
  if (!fs.existsSync(sslBaseDir)) fs.mkdirSync(sslBaseDir, { recursive: true });
  if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir, { recursive: true });
  if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true });
  const pubHtml = path.join(config.xampp.htdocs, 'public_html');
  if (!fs.existsSync(pubHtml)) fs.mkdirSync(pubHtml, { recursive: true });
}

function getOpenSSLPaths() {
  const exe = path.join(config.xampp.apache.binDir, 'openssl.exe');
  const cnf = path.join(config.xampp.apache.dir, 'conf', 'openssl.cnf');
  return {
    exe: fs.existsSync(exe) ? exe : 'openssl',
    cnf: fs.existsSync(cnf) ? cnf : null
  };
}

const securityService = {
  // Return list of all domains with SSL certificate inspection
  getSSLStatus() {
    ensureDirectories();
    const domains = panelDb.getDomains() || [];
    const results = [];

    for (const d of domains) {
      const domainName = d.domain;
      const certPath = path.join(certsDir, `${domainName}.crt`);
      const keyPath = path.join(keysDir, `${domainName}.key`);

      if (fs.existsSync(certPath)) {
        try {
          const certPem = fs.readFileSync(certPath, 'utf8');
          const x509 = new crypto.X509Certificate(certPem);
          const validTo = new Date(x509.validTo);
          const validFrom = new Date(x509.validFrom);
          const now = new Date();
          const msLeft = validTo - now;
          const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
          const isExpired = msLeft <= 0;

          results.push({
            id: d.id,
            domain: domainName,
            type: d.type || 'addon',
            status: isExpired ? 'expired' : 'active',
            issuer: x509.issuer.split('\n')[0] || 'Localhost cPanel AutoSSL',
            subject: x509.subject.split('\n')[0] || domainName,
            validFrom: validFrom.toISOString().split('T')[0],
            validTo: validTo.toISOString().split('T')[0],
            daysLeft: daysLeft,
            fingerprint: x509.fingerprint256 ? x509.fingerprint256.substring(0, 23) + '...' : 'N/A',
            certFile: `${domainName}.crt`,
            keyFile: `${domainName}.key`,
            autoSSL: true
          });
          continue;
        } catch (err) {
          console.error(`[SecurityService] Failed to parse cert for ${domainName}:`, err.message);
        }
      }

      results.push({
        id: d.id,
        domain: domainName,
        type: d.type || 'addon',
        status: 'unsecured',
        issuer: 'None',
        subject: domainName,
        validFrom: 'N/A',
        validTo: 'N/A',
        daysLeft: 0,
        fingerprint: 'N/A',
        certFile: null,
        keyFile: null,
        autoSSL: false
      });
    }

    return results;
  },

  // Generate / renew 2048-bit RSA Certificate via XAMPP OpenSSL
  async runAutoSSL(domainName) {
    ensureDirectories();
    const cleanDomain = (domainName || 'localhost').trim().toLowerCase();
    const certPath = path.join(certsDir, `${cleanDomain}.crt`);
    const keyPath = path.join(keysDir, `${cleanDomain}.key`);
    const { exe, cnf } = getOpenSSLPaths();

    return new Promise((resolve, reject) => {
      const args = [
        'req',
        '-new',
        '-x509',
        '-nodes',
        '-newkey', 'rsa:2048',
        '-days', '365',
        '-keyout', keyPath,
        '-out', certPath,
        '-subj', `/CN=${cleanDomain}/O=Localhost cPanel AutoSSL/OU=Security/C=US`
      ];

      if (cnf) {
        args.push('-config', cnf);
      }

      execFile(exe, args, (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(`OpenSSL AutoSSL failed: ${stderr || err.message}`));
        }

        try {
          const certPem = fs.readFileSync(certPath, 'utf8');
          const x509 = new crypto.X509Certificate(certPem);
          const validTo = new Date(x509.validTo);
          const validFrom = new Date(x509.validFrom);
          const daysLeft = Math.ceil((validTo - new Date()) / (1000 * 60 * 60 * 24));

          panelDb.updateDomainSsl(cleanDomain, {
            sslEnabled: true,
            certPath,
            keyPath,
            issuedAt: new Date().toISOString()
          });

          resolve({
            domain: cleanDomain,
            status: 'active',
            issuer: x509.issuer.split('\n')[0],
            subject: x509.subject.split('\n')[0],
            validFrom: validFrom.toISOString().split('T')[0],
            validTo: validTo.toISOString().split('T')[0],
            daysLeft,
            fingerprint: x509.fingerprint256,
            message: `AutoSSL issued valid 2048-bit certificate for ${cleanDomain}`
          });
        } catch (parseErr) {
          reject(new Error(`Failed to parse generated certificate: ${parseErr.message}`));
        }
      });
    });
  },

  // Get full certificate details and raw PEM
  getCertificateDetails(domainName) {
    const cleanDomain = (domainName || '').trim().toLowerCase();
    const certPath = path.join(certsDir, `${cleanDomain}.crt`);
    const keyPath = path.join(keysDir, `${cleanDomain}.key`);

    if (!fs.existsSync(certPath)) {
      throw new Error(`No certificate found for domain "${cleanDomain}"`);
    }

    const certPem = fs.readFileSync(certPath, 'utf8');
    const x509 = new crypto.X509Certificate(certPem);

    return {
      domain: cleanDomain,
      subject: x509.subject,
      issuer: x509.issuer,
      validFrom: x509.validFrom,
      validTo: x509.validTo,
      fingerprint256: x509.fingerprint256,
      serialNumber: x509.serialNumber,
      keyAlgorithm: 'RSA 2048-bit',
      certPath,
      keyPath: fs.existsSync(keyPath) ? keyPath : null,
      certificatePem: certPem
    };
  },

  // IP Blocker operations
  getBlockedIPs() {
    return panelDb.getBlockedIps() || [];
  },

  addBlockedIP({ ip, comment }) {
    if (!ip || typeof ip !== 'string') {
      throw new Error('Valid IP address or CIDR range is required');
    }
    const cleanIp = ip.trim();
    
    // Validate IPv4 or CIDR notation
    const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\/(3[0-2]|[1-2]?[0-9]))?$/;
    const isSpecial = cleanIp === '::1' || cleanIp === '127.0.0.1' || cleanIp.includes(':');

    if (!ipv4Regex.test(cleanIp) && !isSpecial) {
      throw new Error('Invalid IP address or CIDR format (e.g. 192.168.1.1 or 10.0.0.0/24)');
    }

    const existing = (panelDb.getBlockedIps() || []).find(b => b.ip.toLowerCase() === cleanIp.toLowerCase());
    if (existing) {
      throw new Error(`IP address or range "${cleanIp}" is already blocked`);
    }

    const item = panelDb.addBlockedIp({ ip: cleanIp, comment: comment || '' });
    this.syncHtaccessBlockedIPs();
    return item;
  },

  removeBlockedIP(id) {
    if (!id) throw new Error('Blocked IP ID is required');
    panelDb.removeBlockedIp(id);
    this.syncHtaccessBlockedIPs();
    return { success: true, id };
  },

  // Sync blocked IPs directly to C:\xampp\htdocs\public_html\.htaccess
  syncHtaccessBlockedIPs() {
    const blockedList = panelDb.getBlockedIps() || [];
    let blockDirective = '';

    if (blockedList.length > 0) {
      blockDirective = '\n# --- Managed by Localhost cPanel IP Blocker ---\n<RequireAll>\n    Require all granted\n';
      for (const item of blockedList) {
        blockDirective += `    Require not ip ${item.ip}\n`;
      }
      blockDirective += '</RequireAll>\n# --- End cPanel IP Blocker ---\n';
    }

    try {
      let content = '';
      if (fs.existsSync(htaccessPath)) {
        content = fs.readFileSync(htaccessPath, 'utf8');
      } else {
        content = '# Authentic cPanel default .htaccess\nDirectoryIndex index.php index.html index.htm\n\n<IfModule mod_rewrite.c>\nRewriteEngine On\nRewriteBase /\n</IfModule>\n';
      }

      const markerStart = '# --- Managed by Localhost cPanel IP Blocker ---';
      if (content.includes(markerStart)) {
        const regex = /# --- Managed by Localhost cPanel IP Blocker ---[\s\S]*?# --- End cPanel IP Blocker ---\r?\n?/g;
        content = content.replace(regex, '');
      }

      if (blockDirective) {
        content = content.trimEnd() + '\n' + blockDirective;
      }

      fs.writeFileSync(htaccessPath, content, 'utf8');
    } catch (err) {
      console.error('[SecurityService] Warning: Could not update .htaccess for IP Blocker:', err.message);
    }
  }
};

module.exports = securityService;
