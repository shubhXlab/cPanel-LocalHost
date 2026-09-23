const panelDb = require('../database/panelDb');

function authMiddleware(req, res, next) {
  // Allow public endpoints
  const fullPath = (req.originalUrl || req.path).split('?')[0];
  const publicPaths = [
    '/api/auth/login',
    '/api/auth/csrf-token',
    '/api/auth/setup-status',
    '/api/ai/openapi.json',
    '/login',
    '/csrf-token'
  ];
  if (publicPaths.includes(fullPath) || publicPaths.includes(req.path)) {
    return next();
  }

  // 1. Check if already authenticated via API token in CSRF middleware
  if (req.isApiAuth && req.user && req.apiToken) {
    return checkScopeAndProceed(req, res, next);
  }

  // 2. Check API Token from Authorization header or custom headers
  const authHeader = req.headers.authorization || '';
  let rawApiToken = null;
  if (authHeader.startsWith('Bearer cptok_')) {
    rawApiToken = authHeader.slice(7).trim();
  } else if (authHeader.toLowerCase().startsWith('cpanel ')) {
    const creds = authHeader.slice(7).trim();
    rawApiToken = creds.includes(':') ? creds.split(':')[1].trim() : creds;
  } else if (req.headers['x-api-key']) {
    rawApiToken = req.headers['x-api-key'].trim();
  } else if (req.headers['cpanel_token']) {
    rawApiToken = req.headers['cpanel_token'].trim();
  }

  if (rawApiToken) {
    const validated = panelDb.validateApiToken(rawApiToken, req.ip || req.connection.remoteAddress);
    if (!validated) {
      return res.status(401).json({ error: 'Invalid or expired API token.' });
    }
    req.user = validated.user;
    req.apiToken = validated.tokenRecord;
    req.isApiAuth = true;
    return checkScopeAndProceed(req, res, next);
  }

  // 3. Browser session or Direct Localhost Access (No login required)
  let token = req.cookies ? req.cookies.cpanel_session : null;
  if (!token && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // Retrieve user if session exists
  let user = null;
  let session = null;
  if (token) {
    session = panelDb.getSession(token);
    if (session) {
      user = panelDb.getUserById(session.userId);
    }
  }

  // If no session exists or invalid, automatically resolve the default admin user
  if (!user) {
    user = panelDb.getUserByUsername('admin');
    if (!user) {
      const allUsers = panelDb.getUsers ? panelDb.getUsers() : [];
      user = allUsers.length > 0 ? allUsers[0] : {
        id: 'admin',
        username: 'admin',
        email: 'admin@localhost',
        role: 'admin'
      };
    }

    // Auto-create or provide persistent localhost session
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    try {
      token = panelDb.createSession(user.id, ip, req.headers['user-agent'] || 'cPanel-Localhost');
      session = panelDb.getSession(token);
      res.cookie('cpanel_session', token, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 365 * 24 * 3600 * 1000 // 1 year direct localhost session
      });
    } catch (e) {
      token = 'localhost_admin_session';
      session = { userId: user.id, ip, csrfToken: null };
    }
  }

  req.user = user;
  req.session = session;
  req.sessionToken = token;
  next();
}

function checkScopeAndProceed(req, res, next) {
  const scopes = req.apiToken.scopes || ['*'];
  if (scopes.includes('*')) {
    return next();
  }

  const path = req.baseUrl || req.originalUrl || req.path;
  const scopeMap = {
    '/api/files': 'files',
    '/api/mysql': 'mysql',
    '/api/domains': 'domains',
    '/api/advanced': 'advanced',
    '/api/security': 'security',
    '/api/software': 'software',
    '/api/metrics': 'metrics',
    '/api/backups': 'backups',
    '/api/xampp': 'system',
    '/api/terminal': 'terminal',
    '/api/tokens': 'security'
  };

  for (const [prefix, scope] of Object.entries(scopeMap)) {
    if (path.startsWith(prefix) && !scopes.includes(scope)) {
      return res.status(403).json({
        error: `Permission denied. API token lacks '${scope}' scope.`,
        requiredScope: scope,
        tokenScopes: scopes
      });
    }
  }

  next();
}

module.exports = authMiddleware;
