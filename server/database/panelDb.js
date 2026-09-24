const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');

const dbFilePath = path.join(config.dataDir, 'cpanel_store.json');

// Ensure data and vhosts directories exist
if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}
const vhostsDir = path.join(config.dataDir, 'vhosts');
if (!fs.existsSync(vhostsDir)) {
  fs.mkdirSync(vhostsDir, { recursive: true });
}
if (!fs.existsSync(config.backupsDir)) {
  fs.mkdirSync(config.backupsDir, { recursive: true });
}

// Initial state schema
const defaultState = {
  users: [],
  sessions: {},
  domains: [
    {
      id: 'd1',
      domain: 'localhost',
      documentRoot: path.join(config.xampp.htdocs, 'public_html'),
      type: 'primary',
      phpVersion: 'system',
      sslEnabled: false,
      createdAt: new Date().toISOString()
    }
  ],
  redirects: [],
  cronJobs: [],
  remoteHosts: [],
  zoneRecords: [],
  blockedIps: [],
  applications: [],
  auditLogs: [],
  settings: {
    theme: 'jupiter',
    phpMyAdminUrl: config.xampp.phpMyAdmin.url,
    twoFactorRequired: false,
    maxUploadSizeMB: 100
  },
  apiTokens: []
};

class PanelDatabase {
  constructor() {
    this.data = this.loadData();
    if (!this.data.redirects) this.data.redirects = [];
    if (!this.data.zoneRecords) this.data.zoneRecords = [];
    if (!this.data.blockedIps) this.data.blockedIps = [];
    if (!this.data.applications) this.data.applications = [];
    if (!this.data.cronJobs) this.data.cronJobs = [];
    if (!this.data.errorPages) this.data.errorPages = [];
    if (!this.data.apiTokens) this.data.apiTokens = [];
    this.initDefaultAdmin();
    this.initDefaultDomains();
    this.initDefaultZoneRecords();
    this.initDefaultApplications();
    this.initDefaultCronJobs();
  }

  loadData() {
    try {
      if (fs.existsSync(dbFilePath)) {
        const raw = fs.readFileSync(dbFilePath, 'utf8');
        return Object.assign({}, defaultState, JSON.parse(raw));
      }
    } catch (err) {
      console.error('[PanelDB] Failed to parse db file, initializing defaults:', err.message);
    }
    this.saveData(defaultState);
    return defaultState;
  }

  saveData(data = this.data) {
    const tempPath = `${dbFilePath}.tmp_${Date.now()}`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempPath, dbFilePath);
    } catch (err) {
      try {
        fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf8');
      } catch (e) {
        console.error('[PanelDB] Failed to save DB file:', e.message);
      }
    }
  }

  initDefaultAdmin() {
    if (this.data.users.length === 0) {
      // Default cPanel admin user: admin / admin123 (can be changed in Security settings)
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('admin123', salt);
      const defaultUser = {
        id: 'usr_admin',
        username: 'admin',
        email: 'admin@localhost',
        passwordHash: hashedPassword,
        role: 'root',
        twoFactorEnabled: false,
        twoFactorSecret: null,
        createdAt: new Date().toISOString(),
        lastLogin: null
      };
      this.data.users.push(defaultUser);
      this.saveData();
      console.log('[PanelDB] Initialized default admin user (admin / admin123)');
    }
  }

  initDefaultDomains() {
    if (!this.data.domains || this.data.domains.length === 0) {
      this.data.domains = [
        {
          id: 'd1',
          domain: 'localhost',
          documentRoot: path.join(config.xampp.htdocs, 'public_html'),
          type: 'primary',
          phpVersion: 'system',
          sslEnabled: false,
          createdAt: new Date().toISOString()
        }
      ];
      this.saveData();
    }
  }

  initDefaultZoneRecords() {
    if (!this.data.zoneRecords || this.data.zoneRecords.length === 0) {
      this.data.zoneRecords = [
        { id: 'dns_1', domain: 'localhost', name: 'localhost.', ttl: 14400, class: 'IN', type: 'A', record: '127.0.0.1' },
        { id: 'dns_2', domain: 'localhost', name: 'localhost.', ttl: 14400, class: 'IN', type: 'AAAA', record: '::1' },
        { id: 'dns_3', domain: 'localhost', name: 'mail.localhost.', ttl: 14400, class: 'IN', type: 'CNAME', record: 'localhost.' },
        { id: 'dns_4', domain: 'localhost', name: 'localhost.', ttl: 14400, class: 'IN', type: 'MX', record: '10 mail.localhost.' }
      ];
      this.saveData();
    }
  }

  initDefaultApplications() {
    if (!this.data.applications || this.data.applications.length === 0) {
      const wpDir = path.join(config.xampp.htdocs, 'public_html', 'wordpress');
      this.data.applications = [
        {
          id: 'app_wp',
          name: 'WordPress CMS',
          path: '/wordpress',
          type: 'PHP / CMS (WordPress)',
          docRoot: wpDir,
          url: 'http://localhost/wordpress/',
          env: 'production',
          status: fs.existsSync(wpDir) ? 'running' : 'stopped',
          createdAt: new Date().toISOString()
        },
        {
          id: 'app_root',
          name: 'Primary Web Site',
          path: '/',
          type: 'PHP / HTML',
          docRoot: path.join(config.xampp.htdocs, 'public_html'),
          url: 'http://localhost/',
          env: 'production',
          status: 'running',
          createdAt: new Date().toISOString()
        }
      ];
      this.saveData();
    }
  }

  initDefaultCronJobs() {
    if (!this.data.cronJobs || this.data.cronJobs.length === 0) {
      const wpCronPath = path.join(config.xampp.htdocs, 'public_html', 'wordpress', 'wp-cron.php');
      this.data.cronJobs = [
        {
          id: 'cron_wp',
          schedule: '*/15 * * * *',
          minute: '*/15',
          hour: '*',
          day: '*',
          month: '*',
          weekday: '*',
          command: `php -q "${wpCronPath}"`,
          description: 'WordPress Scheduled Automation (wp-cron)',
          enabled: true,
          lastRun: null,
          lastStatus: 'pending',
          createdAt: new Date().toISOString()
        }
      ];
      this.saveData();
    }
  }

  // --- Users & Auth ---
  getUserByUsername(username) {
    return this.data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  getUserById(id) {
    return this.data.users.find(u => u.id === id);
  }

  updateUser(id, updates) {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.data.users[idx] = Object.assign({}, this.data.users[idx], updates);
      this.saveData();
      return this.data.users[idx];
    }
    return null;
  }

  // --- Sessions ---
  createSession(userId, ip, userAgent) {
    const token = crypto.randomBytes(32).toString('hex');
    const csrfToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + (config.sessionDurationHours * 3600 * 1000);
    
    this.data.sessions[token] = {
      userId,
      csrfToken,
      ip,
      userAgent,
      createdAt: Date.now(),
      expiresAt
    };

    // Clean expired sessions
    for (const [t, s] of Object.entries(this.data.sessions)) {
      if (s.expiresAt < Date.now()) {
        delete this.data.sessions[t];
      }
    }

    this.saveData();
    return token;
  }

  getSession(token) {
    if (!token) return null;
    const session = this.data.sessions[token];
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      delete this.data.sessions[token];
      this.saveData();
      return null;
    }
    return session;
  }

  deleteSession(token) {
    if (this.data.sessions[token]) {
      delete this.data.sessions[token];
      this.saveData();
    }
  }

  // --- Audit Logs ---
  logAction(action, details, userId = 'system', ip = '127.0.0.1') {
    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      details,
      userId,
      ip
    };
    this.data.auditLogs.unshift(entry);
    // Keep last 500 audit logs
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs.pop();
    }
    this.saveData();
  }

  getAuditLogs(limit = 50) {
    return this.data.auditLogs.slice(0, limit);
  }

  // --- Domains & VHosts ---
  getDomains() {
    if (!this.data.domains) this.data.domains = [];
    const hasPrimary = this.data.domains.some(d => d.domain === 'localhost');
    if (!hasPrimary) {
      this.data.domains.unshift({
        id: 'dom_primary',
        domain: 'localhost',
        documentRoot: path.join(config.xampp.htdocs, 'public_html'),
        type: 'primary',
        phpVersion: 'system',
        sslEnabled: false,
        createdAt: new Date().toISOString()
      });
      this.saveData();
    }
    return this.data.domains;
  }

  addDomain(domainData) {
    const domain = Object.assign({
      id: 'dom_' + Date.now(),
      createdAt: new Date().toISOString()
    }, domainData);
    this.data.domains.push(domain);
    this.saveData();
    return domain;
  }

  removeDomain(id) {
    this.data.domains = this.data.domains.filter(d => d.id !== id && d.type !== 'primary');
    this.saveData();
  }

  // --- Cron Jobs ---
  getCronJobs() {
    return this.data.cronJobs || [];
  }

  addCronJob(cron) {
    const job = Object.assign({
      id: 'cron_' + Date.now(),
      active: true,
      lastRun: null,
      createdAt: new Date().toISOString()
    }, cron);
    this.data.cronJobs.push(job);
    this.saveData();
    return job;
  }

  deleteCronJob(id) {
    this.data.cronJobs = this.data.cronJobs.filter(c => c.id !== id);
    this.saveData();
  }

  // --- Remote MySQL Hosts ---
  getRemoteHosts() {
    return this.data.remoteHosts || [];
  }

  addRemoteHost(host, comment = '') {
    if (!this.data.remoteHosts) this.data.remoteHosts = [];
    const existing = this.data.remoteHosts.find(h => h.host === host);
    if (existing) {
      existing.comment = comment;
      this.saveData();
      return existing;
    }
    const record = {
      id: 'rh_' + Date.now(),
      host,
      comment,
      createdAt: new Date().toISOString()
    };
    this.data.remoteHosts.push(record);
    this.saveData();
    return record;
  }

  removeRemoteHost(host) {
    if (!this.data.remoteHosts) return;
    this.data.remoteHosts = this.data.remoteHosts.filter(h => h.host !== host);
    this.saveData();
  }

  // --- Redirects ---
  getRedirects() {
    return this.data.redirects || [];
  }

  addRedirect(redirectData) {
    if (!this.data.redirects) this.data.redirects = [];
    const item = Object.assign({
      id: 'red_' + Date.now(),
      type: redirectData.type || '301',
      domain: redirectData.domain || 'localhost',
      sourcePath: redirectData.sourcePath || '/',
      targetUrl: redirectData.targetUrl || '',
      matchWww: redirectData.matchWww !== false,
      wildcard: !!redirectData.wildcard,
      createdAt: new Date().toISOString()
    }, redirectData);
    this.data.redirects.push(item);
    this.saveData();
    return item;
  }

  removeRedirect(id) {
    if (!this.data.redirects) return;
    this.data.redirects = this.data.redirects.filter(r => r.id !== id);
    this.saveData();
  }

  // --- Zone Records ---
  getZoneRecords(domain = null) {
    const list = this.data.zoneRecords || [];
    if (domain && domain !== 'all') {
      return list.filter(r => r.domain.toLowerCase() === domain.toLowerCase());
    }
    return list;
  }

  addZoneRecord(recordData) {
    if (!this.data.zoneRecords) this.data.zoneRecords = [];
    const item = Object.assign({
      id: 'dns_' + Date.now(),
      ttl: parseInt(recordData.ttl || '14400', 10),
      class: 'IN',
      createdAt: new Date().toISOString()
    }, recordData);
    this.data.zoneRecords.push(item);
    this.saveData();
    return item;
  }

  removeZoneRecord(id) {
    if (!this.data.zoneRecords) return;
    this.data.zoneRecords = this.data.zoneRecords.filter(r => r.id !== id);
    this.saveData();
  }

  // --- Blocked IPs (IP Blocker) ---
  getBlockedIps() {
    return this.data.blockedIps || [];
  }

  addBlockedIp(blockData) {
    if (!this.data.blockedIps) this.data.blockedIps = [];
    const item = {
      id: 'blk_' + Date.now(),
      ip: blockData.ip.trim(),
      comment: (blockData.comment || '').trim(),
      createdAt: new Date().toISOString()
    };
    this.data.blockedIps.push(item);
    this.saveData();
    return item;
  }

  removeBlockedIp(id) {
    if (!this.data.blockedIps) return;
    this.data.blockedIps = this.data.blockedIps.filter(b => b.id !== id);
    this.saveData();
  }

  // --- Domain SSL Status ---
  updateDomainSsl(domainName, sslData) {
    const d = this.data.domains.find(item => item.domain.toLowerCase() === domainName.toLowerCase());
    if (d) {
      d.sslEnabled = sslData.sslEnabled !== false;
      d.sslData = Object.assign({}, d.sslData || {}, sslData);
      this.saveData();
      return d;
    }
    return null;
  }

  // --- Domain PHP Version (MultiPHP Manager) ---
  updateDomainPhp(domainName, phpVersion, fpmEnabled) {
    const d = this.data.domains.find(item => item.domain.toLowerCase() === domainName.toLowerCase());
    if (d) {
      d.phpVersion = phpVersion || 'system';
      if (fpmEnabled !== undefined) d.fpmEnabled = !!fpmEnabled;
      this.saveData();
      return d;
    }
    return null;
  }

  // --- Applications Manager ---
  getApplications() {
    return this.data.applications || [];
  }

  addApplication(appData) {
    if (!this.data.applications) this.data.applications = [];
    const item = Object.assign({
      id: 'app_' + Date.now(),
      status: 'running',
      createdAt: new Date().toISOString()
    }, appData);
    this.data.applications.push(item);
    this.saveData();
    return item;
  }

  removeApplication(id) {
    if (!this.data.applications) return;
    this.data.applications = this.data.applications.filter(a => a.id !== id);
    this.saveData();
  }

  updateApplication(id, updates) {
    if (!this.data.applications) return null;
    const idx = this.data.applications.findIndex(a => a.id === id);
    if (idx !== -1) {
      this.data.applications[idx] = Object.assign({}, this.data.applications[idx], updates);
      this.saveData();
      return this.data.applications[idx];
    }
    return null;
  }

  // --- Cron Jobs ---
  getCronJobs() {
    return this.data.cronJobs || [];
  }

  addCronJob(jobData) {
    if (!this.data.cronJobs) this.data.cronJobs = [];
    const item = Object.assign({
      id: 'cron_' + Date.now(),
      enabled: true,
      lastRun: null,
      lastStatus: 'pending',
      createdAt: new Date().toISOString()
    }, jobData);
    this.data.cronJobs.push(item);
    this.saveData();
    return item;
  }

  removeCronJob(id) {
    if (!this.data.cronJobs) return;
    this.data.cronJobs = this.data.cronJobs.filter(c => c.id !== id);
    this.saveData();
  }

  updateCronJob(id, updates) {
    if (!this.data.cronJobs) return null;
    const idx = this.data.cronJobs.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.data.cronJobs[idx] = Object.assign({}, this.data.cronJobs[idx], updates);
      this.saveData();
      return this.data.cronJobs[idx];
    }
    return null;
  }

  // --- Error Pages ---
  getErrorPages() {
    return this.data.errorPages || [];
  }

  saveErrorPage(pageData) {
    if (!this.data.errorPages) this.data.errorPages = [];
    const cleanCode = String(pageData.code).trim();
    const idx = this.data.errorPages.findIndex(p => String(p.code) === cleanCode);
    const item = {
      code: cleanCode,
      name: pageData.name || `HTTP ${cleanCode}`,
      filename: `${cleanCode}.html`,
      content: pageData.content,
      enabled: pageData.enabled !== false,
      updatedAt: new Date().toISOString()
    };

    if (idx !== -1) {
      this.data.errorPages[idx] = item;
    } else {
      this.data.errorPages.push(item);
    }
    this.saveData();
    return item;
  }

  // --- API Tokens ---
  getApiTokens(userId = null) {
    this.data = this.loadData();
    if (!this.data.apiTokens) this.data.apiTokens = [];
    return this.data.apiTokens
      .filter(t => !userId || t.userId === userId)
      .map(t => ({
        id: t.id,
        name: t.name,
        tokenPrefix: t.tokenPrefix,
        scopes: t.scopes || ['*'],
        expiresAt: t.expiresAt,
        createdAt: t.createdAt,
        lastUsedAt: t.lastUsedAt,
        lastUsedIp: t.lastUsedIp
      }));
  }

  createApiToken({ name, scopes, expiresAt, userId }) {
    this.data = this.loadData();
    if (!this.data.apiTokens) this.data.apiTokens = [];
    const cleanName = (name || 'API Token').trim();
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const rawToken = `cptok_${rawSecret}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenPrefix = `cptok_${rawSecret.substring(0, 6)}...${rawSecret.substring(rawSecret.length - 4)}`;

    const tokenRecord = {
      id: 'tok_' + crypto.randomBytes(8).toString('hex'),
      userId: userId || 'usr_admin',
      name: cleanName,
      tokenPrefix: tokenPrefix,
      tokenHash: tokenHash,
      scopes: Array.isArray(scopes) && scopes.length > 0 ? scopes : ['*'],
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      lastUsedIp: null
    };

    this.data.apiTokens.push(tokenRecord);
    this.saveData();

    return {
      token: {
        id: tokenRecord.id,
        name: tokenRecord.name,
        tokenPrefix: tokenRecord.tokenPrefix,
        scopes: tokenRecord.scopes,
        expiresAt: tokenRecord.expiresAt,
        createdAt: tokenRecord.createdAt
      },
      rawToken: rawToken
    };
  }

  deleteApiToken(id, userId = null) {
    this.data = this.loadData();
    if (!this.data.apiTokens) this.data.apiTokens = [];
    const initialLen = this.data.apiTokens.length;
    this.data.apiTokens = this.data.apiTokens.filter(t => {
      if (t.id !== id) return true;
      if (userId && t.userId !== userId) return true;
      return false;
    });
    const removed = this.data.apiTokens.length < initialLen;
    if (removed) this.saveData();
    return removed;
  }

  validateApiToken(rawToken, clientIp = null) {
    if (!rawToken || typeof rawToken !== 'string') return null;
    this.data = this.loadData();
    if (!this.data.apiTokens) this.data.apiTokens = [];

    const cleanToken = rawToken.trim();
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');
    const record = this.data.apiTokens.find(t => t.tokenHash === tokenHash);
    if (!record) return null;

    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      return null;
    }

    record.lastUsedAt = new Date().toISOString();
    if (clientIp) record.lastUsedIp = clientIp;
    this.saveData();

    const user = this.getUserById(record.userId);
    return {
      tokenRecord: record,
      user: user || { id: record.userId, username: 'admin', role: 'admin' }
    };
  }

  // --- Settings ---
  getSettings() {
    return this.data.settings;
  }

  updateSettings(newSettings) {
    this.data.settings = Object.assign({}, this.data.settings, newSettings);
    this.saveData();
    return this.data.settings;
  }
}

const panelDb = new PanelDatabase();
module.exports = panelDb;
