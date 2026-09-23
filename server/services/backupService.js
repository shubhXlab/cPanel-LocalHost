const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const archiver = require('archiver');
const config = require('../config');
const mysqlPool = require('../database/mysqlPool');

function runCmd(command) {
  return new Promise((resolve) => {
    exec(command, { windowsHide: true }, (err, stdout, stderr) => {
      resolve({ success: !err, stdout: stdout ? stdout.trim() : '', stderr: stderr ? stderr.trim() : '' });
    });
  });
}

const backupService = {
  // Get list of existing backups
  async listBackups() {
    const backupDir = config.backupsDir;
    if (!fs.existsSync(backupDir)) return [];

    const files = await fs.promises.readdir(backupDir);
    const backups = [];

    for (const file of files) {
      if (!file.endsWith('.zip')) continue;
      const full = path.join(backupDir, file);
      const stat = await fs.promises.stat(full);
      backups.push({
        fileName: file,
        sizeMB: (stat.size / 1024 / 1024).toFixed(2),
        createdAt: stat.mtime.toISOString(),
        fullPath: full
      });
    }

    return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  // Create full cPanel backup
  async createFullBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${timestamp}_localhost.zip`;
    const backupFilePath = path.join(config.backupsDir, backupFileName);
    const tempSqlDir = path.join(config.backupsDir, `temp_sql_${Date.now()}`);

    fs.mkdirSync(tempSqlDir, { recursive: true });

    // Step 1: Dump all databases
    const isDbConnected = await mysqlPool.isConnected();
    if (isDbConnected) {
      try {
        const { results: dbs } = await mysqlPool.query('SHOW DATABASES');
        const systemDbs = ['information_schema', 'performance_schema', 'sys'];

        for (const row of dbs) {
          const db = row.Database;
          if (systemDbs.includes(db.toLowerCase())) continue;

          const dumpFile = path.join(tempSqlDir, `${db}.sql`);
          const passFlag = config.xampp.mysql.password ? ` -p"${config.xampp.mysql.password}"` : '';
          const dumpCmd = `"${config.xampp.mysql.dumpExe}" -u ${config.xampp.mysql.user}${passFlag} --databases ${db} --result-file="${dumpFile}"`;
          await runCmd(dumpCmd);
        }
      } catch (e) {
        console.error('[BackupService] MySQL dump error:', e.message);
      }
    }

    // Step 2: Archive everything into zip
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(backupFilePath);
      const archive = archiver('zip', { zlib: { level: 6 } });

      output.on('close', async () => {
        // Clean temp sql dir
        try {
          await fs.promises.rm(tempSqlDir, { recursive: true, force: true });
        } catch (e) {}

        const stat = fs.statSync(backupFilePath);
        resolve({
          success: true,
          fileName: backupFileName,
          sizeMB: (stat.size / 1024 / 1024).toFixed(2),
          createdAt: new Date().toISOString()
        });
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Add SQL dumps directory
      if (fs.existsSync(tempSqlDir)) {
        archive.directory(tempSqlDir, 'mysql_databases');
      }

      // Add htdocs files (excluding large node_modules or temp files)
      if (fs.existsSync(config.xampp.htdocs)) {
        archive.directory(config.xampp.htdocs, 'public_html', (data) => {
          if (data.name.includes('node_modules') || data.name.includes('.git')) {
            return false;
          }
          return data;
        });
      }

      archive.finalize();
    });
  },

  // Restore MySQL database from SQL file
  async restoreDatabase(dbName, sqlFilePath) {
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error('SQL file not found');
    }

    // Create DB if not exists
    await mysqlPool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);

    // Import using mysql CLI
    const passFlag = config.xampp.mysql.password ? ` -p"${config.xampp.mysql.password}"` : '';
    const importCmd = `"${config.xampp.mysql.cliExe}" -u ${config.xampp.mysql.user}${passFlag} ${dbName} < "${sqlFilePath}"`;
    const res = await runCmd(importCmd);

    return { success: res.success, message: res.success ? 'Database restored successfully' : res.stderr };
  }
};

module.exports = backupService;
