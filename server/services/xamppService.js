const { exec, execFile, spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const mysqlPool = require('../database/mysqlPool');

// Helper to execute commands as Promise
function runCmd(command, cwd = config.xampp.root) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        return resolve({ success: false, error: err.message, stdout, stderr });
      }
      resolve({ success: true, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

// Test TCP port connectivity (checks IPv4 and IPv6 dual-stack)
function checkPort(port, host = '127.0.0.1', timeout = 800) {
  const tryHost = (targetHost) => new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, targetHost);
  });

  return tryHost(host).then(async (open) => {
    if (open) return true;
    return await tryHost('::1');
  });
}

const xamppService = {
  // Get full real-time status of XAMPP services
  async getStatus() {
    const mysqlPortOpen = await checkPort(config.xampp.mysql.port);
    const apachePortOpen = await checkPort(config.xampp.apache.port);

    // Fast, silent tasklist check (zero console window, no powershell)
    const tasklistResult = await runCmd('tasklist /NH /FO CSV');
    const stdoutLower = (tasklistResult.stdout || '').toLowerCase();

    const isMysqlProcessRunning = stdoutLower.includes('mysqld.exe');
    const isApacheProcessRunning = stdoutLower.includes('httpd.exe');

    return {
      xamppInstalled: config.xampp.installed,
      xamppPath: config.xampp.root,
      mysql: {
        running: mysqlPortOpen && isMysqlProcessRunning,
        portOpen: mysqlPortOpen,
        processRunning: isMysqlProcessRunning,
        port: config.xampp.mysql.port,
        host: config.xampp.mysql.host
      },
      apache: {
        running: apachePortOpen && isApacheProcessRunning,
        portOpen: apachePortOpen,
        processRunning: isApacheProcessRunning,
        port: config.xampp.apache.port
      },
      phpMyAdmin: {
        url: config.xampp.phpMyAdmin.url,
        available: apachePortOpen && isMysqlProcessRunning && fs.existsSync(config.xampp.phpMyAdmin.dir)
      }
    };
  },

  // Start MySQL detached silently (zero terminal window)
  async startMySQL() {
    const status = await this.getStatus();
    if (status.mysql.running) {
      return { success: true, message: 'MySQL is already running.' };
    }

    try {
      const args = [`--defaults-file=${config.xampp.mysql.iniFile}`, '--standalone'];
      const child = spawn(config.xampp.mysql.daemonExe, args, {
        cwd: config.xampp.root,
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      child.unref();
    } catch (err) {
      return { success: false, message: 'Failed to spawn MySQL process: ' + err.message };
    }

    // Wait up to 8 seconds for MySQL port to open
    for (let i = 0; i < 16; i++) {
      await new Promise(r => setTimeout(r, 500));
      const isOpen = await checkPort(config.xampp.mysql.port);
      if (isOpen) {
        mysqlPool.reconnect();
        try {
          await mysqlPool.query("GRANT ALL PRIVILEGES ON phpmyadmin.* TO 'pma'@'localhost'");
          await mysqlPool.query("GRANT ALL PRIVILEGES ON phpmyadmin.* TO 'pma'@'127.0.0.1'");
          await mysqlPool.query("FLUSH PRIVILEGES");
        } catch (e) {}
        return { success: true, message: 'MySQL service started successfully.' };
      }
    }

    return {
      success: false,
      message: 'Started MySQL process but port 3306 did not respond in time.'
    };
  },

  // Stop MySQL gracefully via mysqladmin
  async stopMySQL() {
    const adminExe = `"${config.xampp.mysql.adminExe}"`;
    const shutdownCmd = `${adminExe} -u ${config.xampp.mysql.user} shutdown`;
    
    await runCmd(shutdownCmd);

    // Check if stopped
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 500));
      const isRunning = await checkPort(config.xampp.mysql.port);
      if (!isRunning) {
        return { success: true, message: 'MySQL service stopped successfully.' };
      }
    }

    // Fallback: taskkill mysqld
    await runCmd('taskkill /F /IM mysqld.exe');
    return { success: true, message: 'MySQL service stopped (taskkill).' };
  },

  async restartMySQL() {
    await this.stopMySQL();
    await new Promise(r => setTimeout(r, 1000));
    return await this.startMySQL();
  },

  // Start Apache detached silently (zero terminal window)
  async startApache() {
    const status = await this.getStatus();
    if (status.apache.running) {
      return { success: true, message: 'Apache is already running.' };
    }

    try {
      const args = ['-d', config.xampp.apache.dir];
      const child = spawn(config.xampp.apache.exe, args, {
        cwd: config.xampp.apache.dir,
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      child.unref();
    } catch (err) {
      return { success: false, message: 'Failed to spawn Apache process: ' + err.message };
    }

    // Wait for Apache port (up to 8 seconds)
    for (let i = 0; i < 16; i++) {
      await new Promise(r => setTimeout(r, 500));
      const isOpen = await checkPort(config.xampp.apache.port);
      if (isOpen) {
        return { success: true, message: 'Apache web server started successfully.' };
      }
    }

    return { success: false, message: 'Apache process started, but port 80 did not open. It may conflict with another service.' };
  },

  // Stop Apache
  async stopApache() {
    await runCmd('taskkill /F /IM httpd.exe');
    return { success: true, message: 'Apache web server stopped.' };
  },

  async restartApache() {
    await this.stopApache();
    await new Promise(r => setTimeout(r, 1000));
    return await this.startApache();
  },

  // Get PHP and MySQL version details
  async getVersions() {
    let phpVersion = 'Not Detected';
    let mysqlVersion = 'Not Detected';
    let apacheVersion = 'Not Detected';

    try {
      const phpRes = await runCmd(`"${config.xampp.php.exe}" -v`);
      if (phpRes.success) {
        const match = phpRes.stdout.match(/PHP\s+([0-9.]+)/i);
        if (match) phpVersion = match[1];
      }
    } catch (e) {}

    try {
      const dbRes = await mysqlPool.query('SELECT VERSION() as version');
      if (dbRes.results && dbRes.results[0]) {
        mysqlVersion = dbRes.results[0].version;
      }
    } catch (e) {}

    try {
      const apacheRes = await runCmd(`"${config.xampp.apache.exe}" -v`);
      if (apacheRes.success) {
        const match = apacheRes.stdout.match(/Server version:\s*Apache\/([0-9.]+)/i);
        if (match) apacheVersion = match[1];
      }
    } catch (e) {}

    return {
      phpVersion,
      mysqlVersion,
      apacheVersion,
      cpanelVersion: '110.0 (Localhost Edition)',
      nodeVersion: process.version,
      platform: process.platform
    };
  }
};

module.exports = xamppService;
