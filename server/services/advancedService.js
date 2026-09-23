const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const { exec } = require('child_process');
const config = require('../config');
const panelDb = require('../database/panelDb');

const pubHtmlDir = path.join(config.xampp.htdocs, 'public_html');
const htaccessPath = path.join(pubHtmlDir, '.htaccess');
const hostsFilePath = 'C:\\Windows\\System32\\drivers\\etc\\hosts';

function runCmd(command, cwd = null) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    exec(command, { windowsHide: true, cwd: cwd || pubHtmlDir, timeout: 20000 }, (err, stdout, stderr) => {
      const durationMs = Date.now() - startTime;
      resolve({
        success: !err,
        exitCode: err ? (err.code || 1) : 0,
        durationMs,
        stdout: stdout ? stdout.trim() : '',
        stderr: stderr ? stderr.trim() : (err ? err.message : '')
      });
    });
  });
}

const defaultErrorTemplates = {
  '400': '<!DOCTYPE html>\n<html>\n<head><title>400 Bad Request</title>\n<style>body{font-family:sans-serif;text-align:center;padding:50px;background:#f8fafc;color:#1e293b;}h1{color:#ef4444;}</style>\n</head>\n<body>\n<h1>400 - Bad Request</h1>\n<p>Your browser sent an invalid request to <code><!--#echo var="REQUEST_URI" --></code>.</p>\n<hr><small>Localhost cPanel Web Server</small>\n</body>\n</html>',
  '401': '<!DOCTYPE html>\n<html>\n<head><title>401 Authorization Required</title>\n<style>body{font-family:sans-serif;text-align:center;padding:50px;background:#f8fafc;color:#1e293b;}h1{color:#f59e0b;}</style>\n</head>\n<body>\n<h1>401 - Authorization Required</h1>\n<p>Authentication credentials are required for <code><!--#echo var="REQUEST_URI" --></code>.</p>\n<hr><small>Localhost cPanel Web Server</small>\n</body>\n</html>',
  '403': '<!DOCTYPE html>\n<html>\n<head><title>403 Forbidden</title>\n<style>body{font-family:sans-serif;text-align:center;padding:50px;background:#f8fafc;color:#1e293b;}h1{color:#ef4444;}</style>\n</head>\n<body>\n<h1>403 - Access Forbidden</h1>\n<p>You do not have permission to access <code><!--#echo var="REQUEST_URI" --></code> from IP <code><!--#echo var="REMOTE_ADDR" --></code>.</p>\n<hr><small>Localhost cPanel Web Server</small>\n</body>\n</html>',
  '404': '<!DOCTYPE html>\n<html>\n<head><title>404 Not Found</title>\n<style>body{font-family:sans-serif;text-align:center;padding:50px;background:#f8fafc;color:#1e293b;}h1{color:#64748b;font-size:48px;margin-bottom:8px;}p{font-size:16px;color:#475569;}</style>\n</head>\n<body>\n<h1>404</h1>\n<h2>Page Not Found</h2>\n<p>The requested URL <code><!--#echo var="REQUEST_URI" --></code> was not found on this server.</p>\n<hr style="max-width:400px;margin:30px auto;border:none;border-top:1px solid #e2e8f0;"><small style="color:#94a3b8;">Localhost cPanel Web Server</small>\n</body>\n</html>',
  '500': '<!DOCTYPE html>\n<html>\n<head><title>500 Internal Server Error</title>\n<style>body{font-family:sans-serif;text-align:center;padding:50px;background:#f8fafc;color:#1e293b;}h1{color:#ef4444;}</style>\n</head>\n<body>\n<h1>500 - Internal Server Error</h1>\n<p>The server encountered an unexpected error processing <code><!--#echo var="REQUEST_URI" --></code>.</p>\n<hr><small>Localhost cPanel Web Server</small>\n</body>\n</html>'
};

const advancedService = {
  // =========================================================================
  // 1. Cron Jobs Manager
  // =========================================================================
  getCronJobs() {
    return panelDb.getCronJobs() || [];
  },

  addCronJob(data) {
    if (!data.command || typeof data.command !== 'string') {
      throw new Error('Cron command to execute is required');
    }

    const min = (data.minute || '*').trim();
    const hr = (data.hour || '*').trim();
    const day = (data.day || '*').trim();
    const month = (data.month || '*').trim();
    const weekday = (data.weekday || '*').trim();
    const schedule = `${min} ${hr} ${day} ${month} ${weekday}`;

    const job = panelDb.addCronJob({
      schedule,
      minute: min,
      hour: hr,
      day,
      month,
      weekday,
      command: data.command.trim(),
      description: (data.description || 'User Scheduled Command').trim(),
      enabled: data.enabled !== false
    });

    return job;
  },

  deleteCronJob(id) {
    if (!id) throw new Error('Cron Job ID is required');
    panelDb.removeCronJob(id);
    return { success: true, id };
  },

  toggleCronJob(id) {
    const list = panelDb.getCronJobs();
    const item = list.find(j => j.id === id);
    if (!item) throw new Error(`Cron job "${id}" not found`);
    return panelDb.updateCronJob(id, { enabled: !item.enabled });
  },

  async runCronJobNow(id) {
    const list = panelDb.getCronJobs();
    const job = list.find(j => j.id === id);
    if (!job) throw new Error(`Cron job "${id}" not found`);

    const result = await runCmd(job.command, pubHtmlDir);
    panelDb.updateCronJob(id, {
      lastRun: new Date().toISOString(),
      lastStatus: result.success ? 'success' : 'failed',
      lastDurationMs: result.durationMs
    });

    return {
      id: job.id,
      command: job.command,
      ...result
    };
  },

  // =========================================================================
  // 2. Error Pages Manager
  // =========================================================================
  getErrorPages() {
    const supportedCodes = ['400', '401', '403', '404', '500'];
    const dbPages = panelDb.getErrorPages() || [];

    return supportedCodes.map(code => {
      const filePath = path.join(pubHtmlDir, `${code}.html`);
      const existsOnDisk = fs.existsSync(filePath);
      const dbEntry = dbPages.find(p => String(p.code) === code);

      let name = 'Error Page';
      if (code === '400') name = 'Bad Request';
      if (code === '401') name = 'Authorization Required';
      if (code === '403') name = 'Forbidden';
      if (code === '404') name = 'Not Found';
      if (code === '500') name = 'Internal Server Error';

      return {
        code,
        name,
        filename: `${code}.html`,
        url: `http://localhost/${code}.html`,
        isCustom: existsOnDisk,
        enabled: dbEntry ? dbEntry.enabled !== false : existsOnDisk,
        updatedAt: dbEntry ? dbEntry.updatedAt : (existsOnDisk ? fs.statSync(filePath).mtime.toISOString() : null)
      };
    });
  },

  getErrorPageContent(code) {
    const cleanCode = String(code).trim();
    const filePath = path.join(pubHtmlDir, `${cleanCode}.html`);

    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
    return defaultErrorTemplates[cleanCode] || defaultErrorTemplates['404'];
  },

  saveErrorPage({ code, content, enabled = true }) {
    const cleanCode = String(code).trim();
    if (!['400', '401', '403', '404', '500'].includes(cleanCode)) {
      throw new Error(`Unsupported HTTP error code ${cleanCode}`);
    }

    if (!fs.existsSync(pubHtmlDir)) {
      fs.mkdirSync(pubHtmlDir, { recursive: true });
    }

    const filePath = path.join(pubHtmlDir, `${cleanCode}.html`);
    fs.writeFileSync(filePath, content || defaultErrorTemplates[cleanCode], 'utf8');

    const entry = panelDb.saveErrorPage({
      code: cleanCode,
      name: `HTTP ${cleanCode}`,
      content,
      enabled: enabled !== false
    });

    this.syncHtaccessErrorPages();
    return entry;
  },

  syncHtaccessErrorPages() {
    const supportedCodes = ['400', '401', '403', '404', '500'];
    const activeDirectives = [];

    for (const code of supportedCodes) {
      const filePath = path.join(pubHtmlDir, `${code}.html`);
      if (fs.existsSync(filePath)) {
        activeDirectives.push(`ErrorDocument ${code} /${code}.html`);
      }
    }

    let errorBlock = '';
    if (activeDirectives.length > 0) {
      errorBlock = '\n# --- Managed by Localhost cPanel Error Pages ---\n' + activeDirectives.join('\n') + '\n# --- End cPanel Error Pages ---\n';
    }

    try {
      let content = '';
      if (fs.existsSync(htaccessPath)) {
        content = fs.readFileSync(htaccessPath, 'utf8');
      } else {
        content = '# Authentic cPanel default .htaccess\nDirectoryIndex index.php index.html index.htm\n\n<IfModule mod_rewrite.c>\nRewriteEngine On\nRewriteBase /\n</IfModule>\n';
      }

      const markerStart = '# --- Managed by Localhost cPanel Error Pages ---';
      if (content.includes(markerStart)) {
        const regex = /# --- Managed by Localhost cPanel Error Pages ---[\s\S]*?# --- End cPanel Error Pages ---\r?\n?/g;
        content = content.replace(regex, '');
      }

      if (errorBlock) {
        content = content.trimEnd() + '\n' + errorBlock;
      }

      fs.writeFileSync(htaccessPath, content, 'utf8');
    } catch (err) {
      console.error('[AdvancedService] Warning: Could not update .htaccess for Error Pages:', err.message);
    }
  },

  // =========================================================================
  // 3. Track DNS (Lookup, Ping, Traceroute, Hosts)
  // =========================================================================
  async lookupDns(domain) {
    const cleanDomain = (domain || '').trim().toLowerCase();
    if (!cleanDomain) throw new Error('Domain or host is required for DNS lookup');

    const results = {
      domain: cleanDomain,
      records: [],
      timestamp: new Date().toISOString()
    };

    // IPv4 A record lookup
    try {
      const aRecords = await dns.resolve4(cleanDomain);
      for (const ip of aRecords) {
        results.records.push({ type: 'A', value: ip, ttl: 300 });
      }
    } catch (e) {
      if (cleanDomain === 'localhost') {
        results.records.push({ type: 'A', value: '127.0.0.1', ttl: 0 });
      }
    }

    // IPv6 AAAA record lookup
    try {
      const aaaaRecords = await dns.resolve6(cleanDomain);
      for (const ip of aaaaRecords) {
        results.records.push({ type: 'AAAA', value: ip, ttl: 300 });
      }
    } catch (e) {
      if (cleanDomain === 'localhost') {
        results.records.push({ type: 'AAAA', value: '::1', ttl: 0 });
      }
    }

    // MX record lookup
    try {
      const mxRecords = await dns.resolveMx(cleanDomain);
      for (const mx of mxRecords) {
        results.records.push({ type: 'MX', value: `${mx.priority} ${mx.exchange}`, ttl: 300 });
      }
    } catch (e) {}

    // TXT record lookup
    try {
      const txtRecords = await dns.resolveTxt(cleanDomain);
      for (const txt of txtRecords) {
        results.records.push({ type: 'TXT', value: txt.join(' '), ttl: 300 });
      }
    } catch (e) {}

    // CNAME record lookup
    try {
      const cnameRecords = await dns.resolveCname(cleanDomain);
      for (const c of cnameRecords) {
        results.records.push({ type: 'CNAME', value: c, ttl: 300 });
      }
    } catch (e) {}

    // NS record lookup
    try {
      const nsRecords = await dns.resolveNs(cleanDomain);
      for (const n of nsRecords) {
        results.records.push({ type: 'NS', value: n, ttl: 300 });
      }
    } catch (e) {}

    return results;
  },

  async runPing(host) {
    const cleanHost = (host || '127.0.0.1').trim().replace(/[^a-zA-Z0-9.-]/g, '');
    const cmd = `ping -n 4 ${cleanHost}`;
    const res = await runCmd(cmd);

    let avgLatency = 'N/A';
    let packetLoss = '0%';

    const lossMatch = res.stdout.match(/([0-9]+)%s*loss/i);
    if (lossMatch) packetLoss = lossMatch[1] + '%';

    const avgMatch = res.stdout.match(/Averages*=s*([0-9]+ms)/i);
    if (avgMatch) avgLatency = avgMatch[1];

    return {
      host: cleanHost,
      command: cmd,
      rawOutput: res.stdout,
      packetLoss,
      avgLatency,
      durationMs: res.durationMs,
      success: res.success
    };
  },

  async runTraceRoute(host) {
    const cleanHost = (host || '127.0.0.1').trim().replace(/[^a-zA-Z0-9.-]/g, '');
    const cmd = `tracert -d -h 10 ${cleanHost}`;
    const res = await runCmd(cmd);

    return {
      host: cleanHost,
      command: cmd,
      rawOutput: res.stdout,
      durationMs: res.durationMs,
      success: res.success
    };
  },

  getHostsFileInfo() {
    let content = '';
    let entries = [];

    if (fs.existsSync(hostsFilePath)) {
      try {
        content = fs.readFileSync(hostsFilePath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2) {
              entries.push({ ip: parts[0], domains: parts.slice(1) });
            }
          }
        }
      } catch (err) {
        content = `# Error reading hosts file: ${err.message}`;
      }
    }

    return {
      path: hostsFilePath,
      entries,
      rawContent: content
    };
  }
};

module.exports = advancedService;
