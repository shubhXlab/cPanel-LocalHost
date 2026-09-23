const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const config = require('../config');
const mysqlPool = require('../database/mysqlPool');

function runCmd(command) {
  return new Promise((resolve) => {
    exec(command, { windowsHide: true }, (err, stdout) => {
      resolve(stdout ? stdout.trim() : '');
    });
  });
}

const sysinfoService = {
  // Real-time server statistics (cPanel Right Sidebar)
  async getStats() {
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemBytes = totalMemBytes - freeMemBytes;
    const memoryUsagePercent = Math.round((usedMemBytes / totalMemBytes) * 100);

    // Real C: drive disk space via native Node.js statfsSync
    let diskStats = { totalGB: 0, freeGB: 0, usedGB: 0, percent: 0 };
    try {
      const s = fs.statfsSync('C:\\');
      const totalBytes = s.bsize * s.blocks;
      const freeBytes = s.bsize * s.bfree;
      const usedBytes = totalBytes - freeBytes;
      diskStats = {
        totalGB: Math.round(totalBytes / 1024 / 1024 / 1024),
        freeGB: Math.round(freeBytes / 1024 / 1024 / 1024),
        usedGB: Math.round(usedBytes / 1024 / 1024 / 1024),
        percent: Math.round((usedBytes / totalBytes) * 100)
      };
    } catch (e) {}

    // MySQL Disk Usage & Count (real schemas only)
    let mysqlSizeMB = 0;
    let dbCount = 0;
    try {
      if (await mysqlPool.isConnected()) {
        const { results: sizeRows } = await mysqlPool.query(`
          SELECT 
            ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS totalMB,
            COUNT(DISTINCT table_schema) as dbCount
          FROM information_schema.tables
          WHERE table_schema NOT IN ('information_schema', 'performance_schema');
        `);
        if (sizeRows && sizeRows[0]) {
          mysqlSizeMB = parseFloat(sizeRows[0].totalMB || '0');
          dbCount = parseInt(sizeRows[0].dbCount || '0', 10);
        }
      }
    } catch (e) {}

    // Real file count in htdocs (Inodes)
    let fileCount = 0;
    try {
      function countFiles(dir, maxDepth = 4, depth = 0) {
        if (!fs.existsSync(dir) || depth > maxDepth) return 0;
        let c = 0;
        try {
          const list = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of list) {
            if (item.isDirectory()) c += countFiles(path.join(dir, item.name), maxDepth, depth + 1);
            else if (item.isFile()) c++;
          }
        } catch (err) {}
        return c;
      }
      fileCount = countFiles(config.xampp.htdocs);
    } catch (e) {}

    return {
      system: {
        platform: os.platform(),
        release: os.release(),
        hostname: os.hostname(),
        uptimeHours: Math.round(os.uptime() / 3600),
        cpuCores: os.cpus().length,
        cpuModel: os.cpus()[0] ? os.cpus()[0].model : 'Unknown',
        sharedIp: '127.0.0.1',
        serverName: 'localhost'
      },
      memory: {
        totalGB: (totalMemBytes / 1024 / 1024 / 1024).toFixed(1),
        usedGB: (usedMemBytes / 1024 / 1024 / 1024).toFixed(1),
        freeGB: (freeMemBytes / 1024 / 1024 / 1024).toFixed(1),
        percent: memoryUsagePercent
      },
      disk: diskStats,
      mysql: {
        sizeMB: mysqlSizeMB,
        dbCount,
        maxDatabases: 'Unlimited'
      },
      inodes: {
        used: fileCount,
        limit: 'Unlimited',
        percent: Math.min(100, Math.round((fileCount / 10000) * 100))
      }
    };
  },

  // Get recent error logs from Apache and MySQL
  async getLogs(type = 'all', lines = 50) {
    const logs = {};

    if (type === 'all' || type === 'apache') {
      const apacheErr = config.xampp.apache.errorLog;
      if (fs.existsSync(apacheErr)) {
        try {
          const content = fs.readFileSync(apacheErr, 'utf8');
          logs.apache = content.split('\n').slice(-lines).join('\n');
        } catch (e) {
          logs.apache = 'Could not read Apache error log.';
        }
      } else {
        logs.apache = 'Apache error log file not found.';
      }
    }

    if (type === 'all' || type === 'mysql') {
      const mysqlErr = config.xampp.mysql.errorLog;
      if (fs.existsSync(mysqlErr)) {
        try {
          const content = fs.readFileSync(mysqlErr, 'utf8');
          logs.mysql = content.split('\n').slice(-lines).join('\n');
        } catch (e) {
          logs.mysql = 'Could not read MySQL error log.';
        }
      } else {
        logs.mysql = 'MySQL error log file not found.';
      }
    }

    return logs;
  },

  // Detailed Disk Usage breakdown for cPanel Disk Usage Tool
  async getDetailedDiskUsage() {
    // 1. System C: Drive overview
    const stats = await this.getStats();
    const diskStats = stats.disk;

    // Helper to calculate folder recursive size
    function calculateFolderStats(dirPath, maxDepth = 4, currentDepth = 0) {
      let totalBytes = 0;
      let fileCount = 0;
      if (!fs.existsSync(dirPath) || currentDepth > maxDepth) {
        return { bytes: 0, files: 0 };
      }
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          try {
            if (entry.isDirectory()) {
              const sub = calculateFolderStats(fullPath, maxDepth, currentDepth + 1);
              totalBytes += sub.bytes;
              fileCount += sub.files;
            } else if (entry.isFile()) {
              const s = fs.statSync(fullPath);
              totalBytes += s.size;
              fileCount++;
            }
          } catch (e) {}
        }
      } catch (e) {}
      return { bytes: totalBytes, files: fileCount };
    }

    // 2. htdocs / public_html total and subfolders
    const htdocsPath = config.xampp.htdocs;
    const htdocsOverall = calculateFolderStats(htdocsPath);
    const subfolders = [];
    try {
      if (fs.existsSync(htdocsPath)) {
        const entries = fs.readdirSync(htdocsPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const fullSub = path.join(htdocsPath, entry.name);
            const subStat = calculateFolderStats(fullSub);
            subfolders.push({
              name: entry.name,
              path: '/' + entry.name,
              sizeBytes: subStat.bytes,
              sizeMB: parseFloat((subStat.bytes / 1024 / 1024).toFixed(2)),
              files: subStat.files
            });
          }
        }
      }
    } catch (e) {}

    // Sort subfolders by size descending
    subfolders.sort((a, b) => b.sizeBytes - a.sizeBytes);

    // 3. MySQL databases breakdown
    const dbList = [];
    let totalDbMB = 0;
    try {
      if (await mysqlPool.isConnected()) {
        const { results } = await mysqlPool.query(`
          SELECT 
            table_schema AS name,
            ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS sizeMB,
            COUNT(table_name) AS tableCount
          FROM information_schema.tables
          WHERE table_schema NOT IN ('information_schema', 'performance_schema')
          GROUP BY table_schema
          ORDER BY SUM(data_length + index_length) DESC
        `);
        if (Array.isArray(results)) {
          for (const r of results) {
            const mb = parseFloat(r.sizeMB || '0');
            totalDbMB += mb;
            dbList.push({
              name: r.name,
              sizeMB: mb,
              tableCount: parseInt(r.tableCount || '0', 10)
            });
          }
        }
      }
    } catch (e) {}

    // 4. Apache logs size
    let apacheLogsStats = { bytes: 0, files: 0 };
    try {
      const logsDir = path.dirname(config.xampp.apache.errorLog);
      apacheLogsStats = calculateFolderStats(logsDir);
    } catch (e) {}

    // 5. Backups size
    let backupStats = { bytes: 0, files: 0 };
    try {
      const backupsDir = path.resolve(__dirname, '../../data/backups');
      backupStats = calculateFolderStats(backupsDir);
    } catch (e) {}

    return {
      disk: diskStats,
      summary: {
        totalGB: diskStats.totalGB,
        usedGB: diskStats.usedGB,
        freeGB: diskStats.freeGB,
        percent: diskStats.percent,
        webRootMB: parseFloat((htdocsOverall.bytes / 1024 / 1024).toFixed(2)),
        webRootFiles: htdocsOverall.files,
        mysqlMB: parseFloat(totalDbMB.toFixed(2)),
        mysqlDatabases: dbList.length,
        logsMB: parseFloat((apacheLogsStats.bytes / 1024 / 1024).toFixed(2)),
        logsFiles: apacheLogsStats.files,
        backupsMB: parseFloat((backupStats.bytes / 1024 / 1024).toFixed(2)),
        backupsFiles: backupStats.files
      },
      webDirectories: subfolders,
      databases: dbList
    };
  },

  // Detailed Server Information (cPanel Server Information Tool)
  async getServerInfo() {
    let apacheVer = 'Apache/2.4 (XAMPP)';
    try {
      const { execSync } = require('child_process');
      const out = execSync(config.xampp.apache.exe + ' -v').toString();
      const match = out.match(/Server version:\s*(.+)/i);
      if (match) apacheVer = match[1].trim();
    } catch (e) {}

    let phpVer = 'PHP 8 (XAMPP)';
    try {
      const { execSync } = require('child_process');
      const out = execSync(config.xampp.php.exe + ' -v').toString();
      const match = out.match(/PHP\s+([0-9.]+)/i);
      if (match) phpVer = match[1].trim();
    } catch (e) {}

    let mysqlVer = 'MariaDB 10.4';
    try {
      if (await mysqlPool.isConnected()) {
        const { results } = await mysqlPool.query('SELECT VERSION() as v');
        if (results && results[0]) mysqlVer = results[0].v;
      }
    } catch (e) {}

    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
    const usedMem = ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(1);

    return {
      cpanelVersion: '110.0 (Localhost XAMPP)',
      apacheVersion: apacheVer,
      phpVersion: phpVer,
      mysqlVersion: mysqlVer,
      architecture: os.arch(),
      os: `${os.type()} ${os.release()}`,
      serverName: os.hostname(),
      serverIp: '127.0.0.1',
      serverPort: config.port || 2083,
      apachePort: config.xampp.apache.port,
      mysqlPort: config.xampp.mysql.port,
      cpuModel: os.cpus()[0] ? os.cpus()[0].model : 'Unknown',
      cpuCores: os.cpus().length,
      memoryTotal: `${totalMem} GB`,
      memoryUsed: `${usedMem} GB`,
      memoryFree: `${freeMem} GB`,
      uptimeHours: +(os.uptime() / 3600).toFixed(1),
      pathApache: config.xampp.apache.exe,
      pathMysql: config.xampp.mysql.daemonExe,
      pathPhp: config.xampp.php.exe,
      pathHtdocs: config.xampp.htdocs
    };
  },

  // 1. Errors Tool: Parsed and structured error log entries
  async getParsedErrors(source = 'apache', lines = 100, filter = '') {
    const filePath = source === 'mysql' ? config.xampp.mysql.errorLog : config.xampp.apache.errorLog;
    if (!fs.existsSync(filePath)) {
      return { source, filePath, totalEntries: 0, entries: [], rawLog: 'Log file does not exist yet.' };
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const allLines = content.trim().split('\n').filter(Boolean);
      const sliceLines = allLines.slice(-Math.min(lines, 500));

      const errRegex = /^\[([^\]]+)\]\s+\[(?:([^:]+):)?([^\]]+)\]\s+(?:\[pid\s+[^\]]+\]\s*)?(?:\[client\s+([^\]]+)\]\s*)?(.*)$/;
      const parsed = [];
      let counts = { error: 0, warn: 0, notice: 0, other: 0 };

      for (const line of sliceLines) {
        const m = line.match(errRegex);
        let item;
        if (m) {
          const rawLevel = (m[3] || 'error').toLowerCase().trim();
          let level = 'error';
          if (rawLevel.includes('warn')) level = 'warn';
          else if (rawLevel.includes('notice') || rawLevel.includes('info')) level = 'notice';
          else level = 'error';

          counts[level] = (counts[level] || 0) + 1;

          item = {
            timestamp: m[1] || '',
            module: m[2] || '',
            level,
            client: m[4] || '-',
            message: (m[5] || '').trim(),
            raw: line.trim()
          };
        } else {
          counts.other++;
          item = {
            timestamp: '',
            module: '',
            level: 'info',
            client: '-',
            message: line.trim(),
            raw: line.trim()
          };
        }

        if (filter) {
          const f = filter.toLowerCase();
          if (!item.message.toLowerCase().includes(f) &&
              !item.client.toLowerCase().includes(f) &&
              !item.level.toLowerCase().includes(f)) {
            continue;
          }
        }
        parsed.push(item);
      }

      // Reverse so newest entries are at the top (cPanel standard)
      parsed.reverse();

      return {
        source,
        filePath,
        totalEntries: parsed.length,
        counts,
        entries: parsed,
        rawLog: sliceLines.slice(-50).join('\n')
      };
    } catch (err) {
      return { source, filePath, totalEntries: 0, counts: { error: 0, warn: 0, notice: 0 }, entries: [], error: err.message };
    }
  },

  // 2. Raw Access Logs Tool: Streaming Apache HTTP requests
  async getRawAccessLogs(lines = 100, filter = '') {
    const accessFile = config.xampp.apache.accessLog;
    if (!fs.existsSync(accessFile)) {
      return { filePath: accessFile, totalRequests: 0, entries: [], rawLog: 'No access log generated yet.' };
    }

    try {
      const content = fs.readFileSync(accessFile, 'utf8');
      const allLines = content.trim().split('\n').filter(Boolean);
      const sliceLines = allLines.slice(-Math.min(lines, 500));

      const regex = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([A-Z]+)\s+([^"\s]+)(?:\s+HTTP\/[0-9.]+)?(?:[^\"]+)?"\s+(\d{3})\s+(\S+)(?:\s+"([^"]*)"\s+"([^"]*)")?/;
      const entries = [];

      for (const line of sliceLines) {
        const m = line.match(regex);
        if (m) {
          const entry = {
            ip: m[1],
            time: m[2],
            method: m[3],
            path: m[4],
            status: parseInt(m[5], 10),
            bytes: m[6] === '-' ? 0 : parseInt(m[6], 10),
            referer: m[7] || '-',
            userAgent: m[8] || '-',
            raw: line.trim()
          };

          if (filter) {
            const f = filter.toLowerCase();
            if (!entry.ip.toLowerCase().includes(f) &&
                !entry.path.toLowerCase().includes(f) &&
                !String(entry.status).includes(f) &&
                !entry.method.toLowerCase().includes(f)) {
              continue;
            }
          }
          entries.push(entry);
        }
      }

      entries.reverse();

      return {
        filePath: accessFile,
        totalRequests: entries.length,
        entries,
        rawLog: sliceLines.slice(-30).join('\n')
      };
    } catch (err) {
      return { filePath: accessFile, totalRequests: 0, entries: [], error: err.message };
    }
  },

  // 3. Resource Usage Tool: Detailed CPU, RAM, Disk I/O, and Active Processes
  async getResourceUsage() {
    const stats = await this.getStats();

    // Query active Windows stack processes
    const processes = await new Promise((resolve) => {
      exec('tasklist /FO CSV /NH', { windowsHide: true }, (err, stdout) => {
        if (err || !stdout) return resolve([]);
        const targetNames = ['httpd.exe', 'mysqld.exe', 'node.exe', 'php.exe'];
        const list = [];
        const lines = stdout.trim().split('\r\n').filter(Boolean);
        for (const line of lines) {
          const parts = line.split('","').map(s => s.replace(/"/g, '').trim());
          if (parts.length >= 5 && targetNames.includes(parts[0].toLowerCase())) {
            let memMB = 0;
            const cleanMem = parts[4].replace(/[^0-9]/g, '');
            if (cleanMem) memMB = parseFloat((parseInt(cleanMem, 10) / 1024).toFixed(1));
            list.push({
              name: parts[0],
              pid: parts[1],
              session: parts[2],
              memKB: parts[4],
              memMB,
              status: 'Running'
            });
          }
        }
        resolve(list);
      });
    });

    const isThrottled = stats.memory.percent > 92;

    return {
      status: isThrottled ? 'Warning: High Memory Load' : 'Normal',
      isThrottled,
      message: isThrottled
        ? 'Physical memory load is above 92%. Consider closing unused applications.'
        : 'Your site and local server are operating smoothly within normal hardware parameters.',
      cpu: {
        model: stats.system.cpuModel,
        cores: stats.system.cpuCores,
        percent: Math.min(100, Math.max(5, Math.round(stats.memory.percent * 0.65))) // approximate active load
      },
      memory: stats.memory,
      disk: stats.disk,
      inodes: stats.inodes,
      mysql: stats.mysql,
      processes,
      limits: {
        maxMemory: `${stats.memory.totalGB} GB (Physical)`,
        maxProcesses: '100 Concurrent',
        entryProcessesLimit: '20 Active',
        ioLimit: 'Unlimited'
      }
    };
  },

  // 4. Visitors Tool: Analytics, unique IPs, bandwidth, and recent requests
  async getVisitors(limit = 300) {
    const raw = await this.getRawAccessLogs(limit);
    const entries = raw.entries || [];

    const uniqueIps = new Set();
    let totalBytes = 0;
    const statusCounts = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    const pageHits = {};
    const browserCounts = { Chrome: 0, Firefox: 0, Safari: 0, Edge: 0, Bot: 0, Other: 0 };

    for (const e of entries) {
      uniqueIps.add(e.ip);
      totalBytes += (e.bytes || 0);

      const codeGroup = `${Math.floor(e.status / 100)}xx`;
      if (statusCounts[codeGroup] !== undefined) {
        statusCounts[codeGroup]++;
      }

      // Top pages
      const cleanPath = e.path.split('?')[0];
      pageHits[cleanPath] = (pageHits[cleanPath] || 0) + 1;

      // Browser detection
      const ua = e.userAgent || '';
      if (ua.includes('Edg/')) browserCounts.Edge++;
      else if (ua.includes('Chrome/')) browserCounts.Chrome++;
      else if (ua.includes('Firefox/')) browserCounts.Firefox++;
      else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browserCounts.Safari++;
      else if (ua.includes('bot') || ua.includes('crawl') || ua.includes('spider')) browserCounts.Bot++;
      else browserCounts.Other++;
    }

    // Top 5 pages
    const topPages = Object.entries(pageHits)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    let totalBytesFormatted = `${(totalBytes / 1024).toFixed(1)} KB`;
    if (totalBytes > 1024 * 1024) {
      totalBytesFormatted = `${(totalBytes / 1024 / 1024).toFixed(2)} MB`;
    }

    return {
      summary: {
        totalRequests: entries.length,
        uniqueVisitors: uniqueIps.size,
        totalBytes,
        totalBytesFormatted,
        statusCounts,
        browserCounts
      },
      topPages,
      visitors: entries
    };
  }
};

module.exports = sysinfoService;

