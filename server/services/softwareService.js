const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const http = require('http');
const config = require('../config');
const panelDb = require('../database/panelDb');

const phpIniPath = config.xampp.php.iniFile;
const phpExePath = config.xampp.php.exe;

function runCmd(command, cwd = null) {
  return new Promise((resolve) => {
    exec(command, { windowsHide: true, cwd: cwd || undefined }, (err, stdout, stderr) => {
      resolve({ success: !err, stdout: stdout ? stdout.trim() : '', stderr: stderr ? stderr.trim() : '' });
    });
  });
}

function pingUrl(url) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    try {
      const u = new URL(url);
      const req = http.request({
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + (u.search || ''),
        method: 'GET',
        timeout: 4000
      }, (res) => {
        const latencyMs = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          latencyMs,
          healthy: res.statusCode >= 200 && res.statusCode < 400
        });
      });

      req.on('error', (err) => {
        resolve({
          statusCode: 0,
          latencyMs: Date.now() - startTime,
          healthy: false,
          error: err.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          statusCode: 408,
          latencyMs: 4000,
          healthy: false,
          error: 'Request timeout'
        });
      });

      req.end();
    } catch (e) {
      resolve({
        statusCode: 0,
        latencyMs: 0,
        healthy: false,
        error: e.message
      });
    }
  });
}

const softwareService = {
  // =========================================================================
  // MultiPHP Manager: Runtime Details & Extensions
  // =========================================================================
  async getPhpDetails() {
    let version = '8.2.12';
    let zendVersion = 'Zend Engine v4.2.12';
    let sapi = 'Apache 2.0 Handler';
    let extensions = [];

    if (fs.existsSync(phpExePath)) {
      const vRes = await runCmd(`"${phpExePath}" -v`);
      if (vRes.success) {
        const vMatch = vRes.stdout.match(/PHP\s+([0-9.]+)/i);
        if (vMatch) version = vMatch[1];
        const zMatch = vRes.stdout.match(/with\s+Zend\s+Engine\s+v([0-9.]+)/i);
        if (zMatch) zendVersion = `Zend Engine v${zMatch[1]}`;
      }

      const mRes = await runCmd(`"${phpExePath}" -m`);
      if (mRes.success) {
        extensions = mRes.stdout
          .split('\n')
          .map(s => s.trim())
          .filter(s => s && !s.startsWith('['));
      }
    }

    const extSet = new Set(extensions.map(e => e.toLowerCase()));
    const categorized = {
      database: ['mysqli', 'pdo', 'pdo_mysql', 'pdo_sqlite', 'sqlite3'].filter(e => extSet.has(e.toLowerCase())),
      network: ['curl', 'openssl', 'sockets', 'ftp'].filter(e => extSet.has(e.toLowerCase())),
      graphics: ['gd', 'exif'].filter(e => extSet.has(e.toLowerCase())),
      archive: ['zip', 'zlib', 'bz2'].filter(e => extSet.has(e.toLowerCase())),
      core: ['bcmath', 'ctype', 'dom', 'fileinfo', 'filter', 'hash', 'iconv', 'intl', 'json', 'mbstring', 'pcre', 'session', 'simplexml', 'soap', 'tokenizer', 'xml', 'xmlreader', 'xmlwriter'].filter(e => extSet.has(e.toLowerCase()))
    };

    return {
      version,
      zendVersion,
      sapi,
      architecture: 'x64',
      threadSafety: 'Enabled (TS)',
      iniPath: phpIniPath,
      exePath: phpExePath,
      totalExtensions: extensions.length,
      extensions: [...new Set(extensions)].sort(),
      categorized
    };
  },

  getDomainsPhp() {
    const domains = panelDb.getDomains() || [];
    return domains.map(d => ({
      id: d.id,
      domain: d.domain,
      type: d.type || 'addon',
      documentRoot: d.documentRoot,
      phpVersion: d.phpVersion || 'PHP 8.2 (System)',
      fpmEnabled: !!d.fpmEnabled
    }));
  },

  setDomainPhp(domainName, phpVersion, fpmEnabled) {
    const cleanDomain = (domainName || '').trim();
    const updated = panelDb.updateDomainPhp(cleanDomain, phpVersion, fpmEnabled);
    if (!updated) {
      throw new Error(`Domain "${cleanDomain}" not found`);
    }
    return updated;
  },

  // =========================================================================
  // MultiPHP INI Editor: Basic & Raw Editor Modes
  // =========================================================================
  async getPhpIniSettings() {
    if (!fs.existsSync(phpIniPath)) {
      return { exists: false, settings: {}, rawContent: '' };
    }

    const content = fs.readFileSync(phpIniPath, 'utf8');

    const extractDirective = (name, fallback) => {
      const regex = new RegExp(`^\\s*${name}\\s*=\\s*([^;\\r\\n]+)`, 'im');
      const match = content.match(regex);
      return match ? match[1].trim() : fallback;
    };

    return {
      exists: true,
      iniPath: phpIniPath,
      settings: {
        memory_limit: extractDirective('memory_limit', '512M'),
        upload_max_filesize: extractDirective('upload_max_filesize', '40M'),
        post_max_size: extractDirective('post_max_size', '40M'),
        max_execution_time: extractDirective('max_execution_time', '120'),
        max_input_time: extractDirective('max_input_time', '60'),
        max_input_vars: extractDirective('max_input_vars', '1000'),
        display_errors: extractDirective('display_errors', 'On'),
        error_reporting: extractDirective('error_reporting', 'E_ALL'),
        file_uploads: extractDirective('file_uploads', 'On'),
        allow_url_fopen: extractDirective('allow_url_fopen', 'On'),
        'zlib.output_compression': extractDirective('zlib.output_compression', 'Off')
      },
      rawContent: content
    };
  },

  async updatePhpIniSettings(newSettings) {
    if (!fs.existsSync(phpIniPath)) {
      throw new Error(`php.ini not found at ${phpIniPath}`);
    }

    let content = fs.readFileSync(phpIniPath, 'utf8');
    const allowedKeys = [
      'memory_limit',
      'upload_max_filesize',
      'post_max_size',
      'max_execution_time',
      'max_input_time',
      'max_input_vars',
      'display_errors',
      'error_reporting',
      'file_uploads',
      'allow_url_fopen',
      'zlib.output_compression'
    ];

    for (const [key, val] of Object.entries(newSettings)) {
      if (!allowedKeys.includes(key)) continue;
      const cleanVal = String(val).trim();
      const escapedKey = key.replace('.', '\\.');
      const regex = new RegExp(`^(\\s*${escapedKey}\\s*=)[^;\\r\\n]+(.*)$`, 'im');

      if (regex.test(content)) {
        content = content.replace(regex, `$1 ${cleanVal}$2`);
      } else {
        content += `\n${key} = ${cleanVal}\n`;
      }
    }

    try {
      fs.copyFileSync(phpIniPath, `${phpIniPath}.bak_${Date.now()}`);
    } catch (e) {}

    fs.writeFileSync(phpIniPath, content, 'utf8');
    return { success: true, message: 'php.ini directives updated successfully.' };
  },

  async saveRawPhpIni(rawContent) {
    if (typeof rawContent !== 'string' || !rawContent.trim()) {
      throw new Error('php.ini content cannot be empty');
    }

    if (!fs.existsSync(phpIniPath)) {
      throw new Error(`php.ini not found at ${phpIniPath}`);
    }

    try {
      fs.copyFileSync(phpIniPath, `${phpIniPath}.bak_${Date.now()}`);
    } catch (e) {}

    fs.writeFileSync(phpIniPath, rawContent, 'utf8');
    return { success: true, message: 'php.ini file saved successfully.' };
  },

  // =========================================================================
  // Application Manager: Web Applications Lifecycle
  // =========================================================================
  async getApplications() {
    const apps = panelDb.getApplications() || [];
    const results = [];

    for (const app of apps) {
      let isHealthy = false;
      let latency = 0;
      let status = 'running';

      if (app.url && app.url.startsWith('http')) {
        const ping = await pingUrl(app.url);
        isHealthy = ping.healthy;
        latency = ping.latencyMs;
        status = ping.healthy ? 'running' : 'unhealthy';
      } else {
        status = fs.existsSync(app.docRoot) ? 'running' : 'stopped';
        isHealthy = status === 'running';
      }

      results.push({
        ...app,
        status,
        healthy: isHealthy,
        latencyMs: latency
      });
    }

    return results;
  },

  registerApplication(data) {
    if (!data.name || typeof data.name !== 'string') {
      throw new Error('Application Name is required');
    }
    const cleanName = data.name.trim();
    let cleanPath = (data.path || '').trim();
    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;

    let docRoot = data.docRoot ? data.docRoot.trim() : path.join(config.xampp.htdocs, 'public_html', cleanPath.replace(/^\//, ''));
    if (!fs.existsSync(docRoot)) {
      fs.mkdirSync(docRoot, { recursive: true });
    }

    const cleanUrl = data.url ? data.url.trim() : `http://localhost${cleanPath === '/' ? '' : cleanPath}/`;

    return panelDb.addApplication({
      name: cleanName,
      path: cleanPath,
      type: data.type || 'PHP / HTML',
      docRoot,
      url: cleanUrl,
      env: data.env || 'production'
    });
  },

  deleteApplication(id) {
    if (!id) throw new Error('Application ID is required');
    panelDb.removeApplication(id);
    return { success: true, id };
  },

  async checkAppHealth(id) {
    const apps = panelDb.getApplications() || [];
    const app = apps.find(a => a.id === id);
    if (!app) throw new Error(`Application "${id}" not found`);

    const result = await pingUrl(app.url);
    panelDb.updateApplication(id, {
      status: result.healthy ? 'running' : 'unhealthy',
      lastChecked: new Date().toISOString()
    });

    return {
      id: app.id,
      name: app.name,
      url: app.url,
      ...result
    };
  }
};

module.exports = softwareService;
