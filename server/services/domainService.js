const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const config = require('../config');
const panelDb = require('../database/panelDb');

function getVhostsConfPath() {
  return config.xampp.apache.vhostsConf;
}

const domainService = {
  // Get all registered domains (always ensures localhost is present)
  getDomains() {
    return panelDb.getDomains();
  },

  // Add a domain or subdomain
  async addDomain({ domain, documentRoot, type = 'addon' }) {
    if (!domain || typeof domain !== 'string') {
      throw new Error('Domain name is required');
    }

    // Clean domain: strip protocol, trailing slashes/paths, whitespace, lowercase, and ports
    let cleanDomain = domain.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '').trim();

    // Validation (supports letters, numbers, hyphens, and underscores for local dev)
    if (!/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9_-]*[a-z0-9])?)+$/i.test(cleanDomain) && cleanDomain !== 'localhost') {
      throw new Error('Invalid domain format. Example: mysite.local, app.test, blog.mysite.local');
    }

    const domains = panelDb.getDomains();
    const existing = domains.find(d => d.domain.toLowerCase() === cleanDomain);
    if (existing) {
      throw new Error(`Domain "${cleanDomain}" is already configured in cPanel`);
    }

    // Resolve document root safely (preventing Windows root slash bug)
    let finalDocRoot = (documentRoot || '').trim();
    if (!finalDocRoot) {
      // Default: inside public_html/<domain_safe_folder>
      const folderName = cleanDomain.replace(/[^a-zA-Z0-9_-]/g, '_');
      finalDocRoot = path.join(config.xampp.htdocs, 'public_html', folderName);
    } else if (/^[a-zA-Z]:[/\\]/.test(finalDocRoot)) {
      // Absolute path on Windows
      finalDocRoot = path.normalize(finalDocRoot);
    } else {
      // Relative path: strip leading slashes
      const cleanRel = finalDocRoot.replace(/^[/\\]+/, '');
      finalDocRoot = path.join(config.xampp.htdocs, cleanRel);
    }

    // Ensure document root directory exists
    try {
      if (!fs.existsSync(finalDocRoot)) {
        fs.mkdirSync(finalDocRoot, { recursive: true });
      }

      // If no index file exists, create a default welcome page
      const indexPhp = path.join(finalDocRoot, 'index.php');
      const indexHtml = path.join(finalDocRoot, 'index.html');
      if (!fs.existsSync(indexPhp) && !fs.existsSync(indexHtml)) {
        const welcomeContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${cleanDomain}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); max-width: 540px; width: 100%; text-align: center; border: 1px solid #e2e8f0; }
    .badge { display: inline-block; background: #eff6ff; color: #2563eb; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 16px; border: 1px solid #bfdbfe; }
    h1 { margin: 0 0 12px; font-size: 26px; color: #0f172a; }
    p { color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px; }
    code { background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #0f172a; word-break: break-all; }
    .btn { display: inline-block; background: #ff6c2c; color: white; text-decoration: none; padding: 10px 22px; border-radius: 6px; font-weight: 600; font-size: 13px; transition: background 0.15s ease; }
    .btn:hover { background: #e05619; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">VirtualHost Active &bull; Localhost</span>
    <h1>Welcome to ${cleanDomain}</h1>
    <p>This virtual host is successfully configured and running locally via <strong>cPanel Localhost</strong>.</p>
    <p>Document Root:<br><code><?php echo htmlspecialchars(__DIR__); ?></code></p>
    <a href="http://localhost:2083" class="btn">Open cPanel Dashboard</a>
  </div>
</body>
</html>\n`;
        fs.writeFileSync(indexPhp, welcomeContent, 'utf8');
      }
    } catch (e) {
      console.warn('[DomainService] Notice creating docroot:', e.message);
    }

    const domainRecord = panelDb.addDomain({
      domain: cleanDomain,
      documentRoot: finalDocRoot,
      type: type === 'subdomain' ? 'subdomain' : 'addon',
      phpVersion: 'system',
      sslEnabled: true
    });

    // Auto-create initial DNS zone records for the new domain
    const dotDomain = `${cleanDomain}.`;
    panelDb.addZoneRecord({ domain: cleanDomain, name: dotDomain, type: 'A', record: '127.0.0.1', ttl: 14400 });
    if (type !== 'subdomain') {
      panelDb.addZoneRecord({ domain: cleanDomain, name: `www.${dotDomain}`, type: 'CNAME', record: dotDomain, ttl: 14400 });
    }

    // Update Apache httpd-vhosts.conf and reload Apache
    await this.syncApacheVhosts();

    return domainRecord;
  },

  // Remove a domain
  async removeDomain(id) {
    const domainRecord = panelDb.getDomains().find(d => d.id === id);
    if (!domainRecord) {
      throw new Error('Domain not found');
    }
    if (domainRecord.type === 'primary' || domainRecord.domain === 'localhost') {
      throw new Error('Cannot delete primary localhost domain');
    }

    // Remove associated DNS zone records
    const records = panelDb.getZoneRecords(domainRecord.domain);
    records.forEach(r => panelDb.removeZoneRecord(r.id));

    // Remove associated redirects
    const redirects = panelDb.getRedirects().filter(r => r.domain === domainRecord.domain);
    redirects.forEach(r => panelDb.removeRedirect(r.id));

    panelDb.removeDomain(id);

    // Update Apache httpd-vhosts.conf and reload Apache
    await this.syncApacheVhosts();
    return { success: true };
  },

  // Sync virtual host entries into XAMPP httpd-vhosts.conf
  async syncApacheVhosts() {
    const domains = panelDb.getDomains();
    const primaryDomain = domains.find(d => d.domain === 'localhost');
    const primaryRoot = (primaryDomain && primaryDomain.documentRoot ? primaryDomain.documentRoot : path.join(config.xampp.htdocs, 'public_html')).replace(/\\/g, '/');
    const forwardApache = config.xampp.apache.dir.replace(/\\/g, '/');
    const sslCertPath = `${forwardApache}/conf/ssl.crt/server.crt`;
    const sslKeyPath = `${forwardApache}/conf/ssl.key/server.key`;
    const hasSslFiles = fs.existsSync(path.join(config.xampp.apache.dir, 'conf', 'ssl.crt', 'server.crt'));

    let vhostBlock = `\n# --- Managed by Localhost cPanel (${new Date().toISOString()}) ---\n`;

    // 1. Primary localhost VirtualHost (Port 80)
    vhostBlock += `<VirtualHost *:80>\n`;
    vhostBlock += `    ServerName localhost\n`;
    vhostBlock += `    ServerAlias 127.0.0.1\n`;
    vhostBlock += `    DocumentRoot "${primaryRoot}"\n`;
    vhostBlock += `    <Directory "${primaryRoot}">\n`;
    vhostBlock += `        Options Indexes FollowSymLinks MultiViews\n`;
    vhostBlock += `        AllowOverride All\n`;
    vhostBlock += `        Require all granted\n`;
    vhostBlock += `    </Directory>\n`;
    vhostBlock += `</VirtualHost>\n\n`;

    // 1b. Primary localhost VirtualHost (Port 443 SSL)
    if (hasSslFiles) {
      vhostBlock += `<VirtualHost *:443>\n`;
      vhostBlock += `    ServerName localhost\n`;
      vhostBlock += `    ServerAlias 127.0.0.1\n`;
      vhostBlock += `    DocumentRoot "${primaryRoot}"\n`;
      vhostBlock += `    SSLEngine on\n`;
      vhostBlock += `    SSLCertificateFile "${sslCertPath}"\n`;
      vhostBlock += `    SSLCertificateKeyFile "${sslKeyPath}"\n`;
      vhostBlock += `    <Directory "${primaryRoot}">\n`;
      vhostBlock += `        Options Indexes FollowSymLinks MultiViews\n`;
      vhostBlock += `        AllowOverride All\n`;
      vhostBlock += `        Require all granted\n`;
      vhostBlock += `    </Directory>\n`;
      vhostBlock += `</VirtualHost>\n\n`;
    }

    // 2. Custom Addon Domains & Subdomains
    for (const d of domains) {
      if (d.domain === 'localhost') continue;
      const normalizedRoot = d.documentRoot.replace(/\\/g, '/');

      // Port 80
      vhostBlock += `<VirtualHost *:80>\n`;
      vhostBlock += `    ServerName ${d.domain}\n`;
      if (d.type !== 'subdomain') {
        vhostBlock += `    ServerAlias www.${d.domain}\n`;
      }
      vhostBlock += `    DocumentRoot "${normalizedRoot}"\n`;
      vhostBlock += `    <Directory "${normalizedRoot}">\n`;
      vhostBlock += `        Options Indexes FollowSymLinks MultiViews\n`;
      vhostBlock += `        AllowOverride All\n`;
      vhostBlock += `        Require all granted\n`;
      vhostBlock += `    </Directory>\n`;
      vhostBlock += `</VirtualHost>\n\n`;

      // Port 443 (SSL)
      if (hasSslFiles) {
        vhostBlock += `<VirtualHost *:443>\n`;
        vhostBlock += `    ServerName ${d.domain}\n`;
        if (d.type !== 'subdomain') {
          vhostBlock += `    ServerAlias www.${d.domain}\n`;
        }
        vhostBlock += `    DocumentRoot "${normalizedRoot}"\n`;
        vhostBlock += `    SSLEngine on\n`;
        vhostBlock += `    SSLCertificateFile "${sslCertPath}"\n`;
        vhostBlock += `    SSLCertificateKeyFile "${sslKeyPath}"\n`;
        vhostBlock += `    <Directory "${normalizedRoot}">\n`;
        vhostBlock += `        Options Indexes FollowSymLinks MultiViews\n`;
        vhostBlock += `        AllowOverride All\n`;
        vhostBlock += `        Require all granted\n`;
        vhostBlock += `    </Directory>\n`;
        vhostBlock += `</VirtualHost>\n\n`;
      }
    }

    const vhostsFile = getVhostsConfPath();
    if (fs.existsSync(vhostsFile)) {
      try {
        let content = fs.readFileSync(vhostsFile, 'utf8');
        const markerStart = '# --- Managed by Localhost cPanel';
        if (content.includes(markerStart)) {
          const regex = new RegExp('# --- Managed by Localhost cPanel[\\s\\S]*?# --- End Localhost cPanel ---', 'g');
          content = content.replace(regex, '');
        }
        content += `${vhostBlock}# --- End Localhost cPanel ---\n`;
        fs.writeFileSync(vhostsFile, content, 'utf8');
      } catch (err) {
        console.error('[DomainService] Warning: Could not write to httpd-vhosts.conf:', err.message);
      }
    }

    // Automatically reload Apache if running
    try {
      const xamppService = require('./xamppService');
      const status = await xamppService.getStatus();
      if (status.apache.running) {
        await xamppService.restartApache();
      }
    } catch (e) {
      console.warn('[DomainService] Warning restarting Apache after vhost update:', e.message);
    }
  },

  // Sync redirects into .htaccess using mod_rewrite rules
  async syncHtaccessRedirects() {
    const redirects = panelDb.getRedirects();

    // Group redirects by target .htaccess file
    const filesToUpdate = new Map();

    const primaryHtaccess = path.join(config.xampp.htdocs, 'public_html', '.htaccess');
    filesToUpdate.set(primaryHtaccess, []);

    const allDomains = panelDb.getDomains();
    for (const d of allDomains) {
      if (d.domain === 'localhost') continue;
      const dHtaccess = path.join(d.documentRoot, '.htaccess');
      if (!filesToUpdate.has(dHtaccess)) {
        filesToUpdate.set(dHtaccess, []);
      }
    }

    for (const r of redirects) {
      if (r.domain === 'all' || r.domain === 'localhost') {
        filesToUpdate.get(primaryHtaccess).push(r);
      } else {
        const targetDomain = allDomains.find(d => d.domain === r.domain);
        if (targetDomain) {
          const dHtaccess = path.join(targetDomain.documentRoot, '.htaccess');
          if (filesToUpdate.has(dHtaccess)) {
            filesToUpdate.get(dHtaccess).push(r);
          }
        } else {
          filesToUpdate.get(primaryHtaccess).push(r);
        }
      }
    }

    for (const [filePath, ruleList] of filesToUpdate.entries()) {
      try {
        let content = '';
        if (fs.existsSync(filePath)) {
          content = fs.readFileSync(filePath, 'utf8');
        } else {
          content = '# Authentic cPanel default .htaccess\nDirectoryIndex index.php index.html index.htm\n\n<IfModule mod_rewrite.c>\nRewriteEngine On\nRewriteBase /\n</IfModule>\n';
        }

        const markerStart = '# --- Managed by Localhost cPanel Redirects ---';
        if (content.includes(markerStart)) {
          const regex = new RegExp('# --- Managed by Localhost cPanel Redirects ---[\\s\\S]*?# --- End cPanel Redirects ---\\n?', 'g');
          content = content.replace(regex, '');
        }

        if (ruleList.length > 0) {
          let block = '\n# --- Managed by Localhost cPanel Redirects ---\n<IfModule mod_rewrite.c>\nRewriteEngine On\n';
          for (const r of ruleList) {
            const code = r.type === '302' ? '302' : '301';
            let src = (r.sourcePath || '').trim().replace(/^\/+/, ''); // strip leading slashes
            const escapedDomain = r.domain.replace(/\./g, '\\.');

            if (r.domain !== 'all') {
              if (r.matchWww === 'only') {
                block += `RewriteCond %{HTTP_HOST} ^www\\.${escapedDomain}$ [NC]\n`;
              } else if (r.matchWww === 'none') {
                block += `RewriteCond %{HTTP_HOST} ^${escapedDomain}$ [NC]\n`;
              } else {
                block += `RewriteCond %{HTTP_HOST} ^(www\\.)?${escapedDomain}$ [NC]\n`;
              }
            }

            if (!src) {
              // Root redirect
              block += `RewriteRule ^$ ${r.targetUrl} [R=${code},L]\n`;
            } else if (r.wildcard) {
              block += `RewriteRule ^${src}(/.*)?$ ${r.targetUrl}$1 [R=${code},L]\n`;
            } else {
              block += `RewriteRule ^${src}/?$ ${r.targetUrl} [R=${code},L]\n`;
            }
          }
          block += '</IfModule>\n# --- End cPanel Redirects ---\n';
          content += block;
        }

        fs.writeFileSync(filePath, content, 'utf8');
      } catch (e) {
        console.warn(`[DomainService] Notice updating ${filePath}:`, e.message);
      }
    }
  },

  // Redirects Management
  getRedirects() {
    return panelDb.getRedirects();
  },

  async addRedirect(redirectData) {
    if (!redirectData.targetUrl || typeof redirectData.targetUrl !== 'string') {
      throw new Error('Destination Target URL is required');
    }
    let src = (redirectData.sourcePath || '').trim();
    if (src && !src.startsWith('/')) src = '/' + src;
    if (!src) src = '/';

    const record = panelDb.addRedirect({
      type: redirectData.type === '302' ? '302' : '301',
      domain: redirectData.domain || 'all',
      sourcePath: src,
      targetUrl: redirectData.targetUrl.trim(),
      matchWww: redirectData.matchWww || 'both',
      wildcard: !!redirectData.wildcard
    });

    await this.syncHtaccessRedirects();
    return record;
  },

  async removeRedirect(id) {
    panelDb.removeRedirect(id);
    await this.syncHtaccessRedirects();
    return { success: true };
  },

  // Zone Records Management
  getZoneRecords(domain = null) {
    return panelDb.getZoneRecords(domain);
  },

  async addZoneRecord(data) {
    if (!data.name || !data.type || !data.record) {
      throw new Error('Record name, type (A, CNAME, TXT, MX), and value are required');
    }
    const cleanType = data.type.toUpperCase().trim();
    if (!['A', 'AAAA', 'CNAME', 'TXT', 'MX'].includes(cleanType)) {
      throw new Error('Invalid record type. Supported: A, AAAA, CNAME, TXT, MX');
    }

    let cleanName = data.name.trim();
    if (!cleanName.endsWith('.')) cleanName += '.';

    const record = panelDb.addZoneRecord({
      domain: data.domain || 'localhost',
      name: cleanName,
      type: cleanType,
      record: data.record.trim(),
      ttl: parseInt(data.ttl || '14400', 10)
    });

    return record;
  },

  async removeZoneRecord(id) {
    panelDb.removeZoneRecord(id);
    return { success: true };
  },

  // Get Windows hosts file guidance + live resolution status
  getHostsFileGuidance() {
    const domains = panelDb.getDomains();
    const entries = ['127.0.0.1  localhost'];
    const domainStatus = [];

    let hostsContent = '';
    const hostsFilePath = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
    try {
      if (fs.existsSync(hostsFilePath)) {
        hostsContent = fs.readFileSync(hostsFilePath, 'utf8');
      }
    } catch (e) {}

    for (const d of domains) {
      if (d.domain === 'localhost') {
        domainStatus.push({
          id: d.id,
          domain: 'localhost',
          type: 'primary',
          mappedInHosts: true,
          entry: '127.0.0.1  localhost'
        });
        continue;
      }

      const isSub = d.type === 'subdomain';
      const hostLine = isSub ? `127.0.0.1  ${d.domain}` : `127.0.0.1  ${d.domain} www.${d.domain}`;
      entries.push(hostLine);

      // Check if domain is present in hosts content
      const regex = new RegExp(`(^|\\s)${d.domain.replace(/\./g, '\\.')}(\\s|$)`, 'im');
      const isMapped = regex.test(hostsContent);

      domainStatus.push({
        id: d.id,
        domain: d.domain,
        type: d.type,
        mappedInHosts: isMapped,
        entry: hostLine
      });
    }

    // Also include custom A records from DNS Zone Editor
    const zoneRecords = panelDb.getZoneRecords();
    for (const z of zoneRecords) {
      if (z.type === 'A' && z.record === '127.0.0.1') {
        const cleanName = z.name.replace(/\.$/, '');
        if (!entries.some(e => e.includes(cleanName))) {
          entries.push(`127.0.0.1  ${cleanName}`);
        }
      }
    }

    const allMapped = domainStatus.every(s => s.mappedInHosts);

    return {
      filePath: hostsFilePath,
      entries,
      rawText: entries.join('\r\n'),
      domains: domainStatus,
      allMapped
    };
  },

  // Auto-sync hosts file using elevated PowerShell
  async syncHostsFile() {
    const guidance = this.getHostsFileGuidance();
    const managedHeader = '# --- Managed by Localhost cPanel ---';
    const managedFooter = '# --- End Localhost cPanel ---';
    const linesToInsert = `${managedHeader}\r\n${guidance.rawText}\r\n${managedFooter}`;

    // Base64-encode the PowerShell script to safely execute with RunAs without quoting issues
    const psScript = `
      $path = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
      $content = [System.IO.File]::ReadAllText($path);
      $block = @"
${linesToInsert}
"@;
      if ($content -match '(?ms)# --- Managed by Localhost cPanel ---.*?# --- End Localhost cPanel ---') {
        $content = $content -replace '(?ms)# --- Managed by Localhost cPanel ---.*?# --- End Localhost cPanel ---', $block;
      } else {
        $content = $content.TrimEnd() + [Environment]::NewLine + [Environment]::NewLine + $block + [Environment]::NewLine;
      }
      [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8);
    `;

    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    const cmd = `powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -WindowStyle Hidden -EncodedCommand ${encoded}'"`;

    return new Promise((resolve, reject) => {
      exec(cmd, { windowsHide: true }, (err) => {
        if (err) return reject(new Error('Failed to launch elevated hosts updater: ' + err.message));
        resolve({ success: true, message: 'Windows hosts file update initiated. Please accept the UAC prompt if prompted.' });
      });
    });
  }
};

module.exports = domainService;
