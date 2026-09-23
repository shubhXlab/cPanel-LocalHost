const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config');

const authMiddleware = require('./middleware/auth');
const { csrfMiddleware } = require('./middleware/csrf');

const authRoutes = require('./routes/auth');
const xamppRoutes = require('./routes/xampp');
const mysqlRoutes = require('./routes/mysql');
const fileRoutes = require('./routes/files');
const domainRoutes = require('./routes/domains');
const softwareRoutes = require('./routes/software');
const backupRoutes = require('./routes/backups');
const metricsRoutes = require('./routes/metrics');
const terminalRoutes = require('./routes/terminal');
const securityRoutes = require('./routes/security');
const advancedRoutes = require('./routes/advanced');
const apiTokenRoutes = require('./routes/apiTokens');

const app = express();

// Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Allows inline script evaluation for local cPanel tools
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'sameorigin' }
}));

// Cross-origin Resource Sharing (Localhost only)
app.use(cors({
  origin: true,
  credentials: true
}));

// Body & Cookie Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser(config.sessionSecret));

// CSRF Protection Middleware
app.use(csrfMiddleware);

// Disable caching for localhost development
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Serve static frontend assets
const clientDir = path.resolve(__dirname, '../client');
app.use(express.static(clientDir));

// Auth routes (some public, some protected like /me)
app.use('/api/auth', authMiddleware, authRoutes);

// Protected API routes
app.use('/api/xampp', authMiddleware, xamppRoutes);
app.use('/api/mysql', authMiddleware, mysqlRoutes);
app.use('/api/files', authMiddleware, fileRoutes);
app.use('/api/domains', authMiddleware, domainRoutes);
app.use('/api/software', authMiddleware, softwareRoutes);
app.use('/api/backups', authMiddleware, backupRoutes);
app.use('/api/metrics', authMiddleware, metricsRoutes);
app.use('/api/terminal', authMiddleware, terminalRoutes);
app.use('/api/security', authMiddleware, securityRoutes);
app.use('/api/advanced', authMiddleware, advancedRoutes);
app.use('/api', authMiddleware, apiTokenRoutes);

// Frontend HTML routing - Direct dashboard access (Login bypassed)
app.get('/login', (req, res) => {
  res.redirect('/');
});

app.get('*', (req, res) => {
  // If requesting API that was not found
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  // If requesting a specific missing file with extension
  if (path.extname(req.path)) {
    return res.status(404).send('404 Not Found');
  }
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack || err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'ERR_INTERNAL'
  });
});

module.exports = app;
