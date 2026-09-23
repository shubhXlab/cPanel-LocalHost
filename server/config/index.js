require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const xamppConfig = require('./xamppConfig');

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '2083', 10),
  host: process.env.HOST || '127.0.0.1',
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  csrfSecret: process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex'),
  
  // Storage paths
  dataDir: path.resolve(__dirname, '../../data'),
  backupsDir: path.resolve(__dirname, '../../backups'),
  
  // File manager allowed roots
  allowedRoots: [
    xamppConfig.htdocs,
    path.resolve(__dirname, '../../data/vhosts')
  ],

  // Security limits
  maxLoginAttempts: 5,
  lockoutMinutes: 15,
  sessionDurationHours: 24,

  xampp: xamppConfig
};

module.exports = config;
