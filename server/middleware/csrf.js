const crypto = require('crypto');
const config = require('../config');

// Generate a random CSRF token
function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

const panelDb = require('../database/panelDb');

// CSRF middleware
function csrfMiddleware(req, res, next) {
  // Read existing or create new CSRF cookie
  let csrfCookie = req.cookies ? req.cookies.cpanel_csrf : null;
  if (!csrfCookie) {
    csrfCookie = generateCsrfToken();
    res.cookie('cpanel_csrf', csrfCookie, {
      httpOnly: false, // Frontend JS reads this to include in headers
      sameSite: 'strict',
      maxAge: 86400000
    });
    if (!req.cookies) req.cookies = {};
    req.cookies.cpanel_csrf = csrfCookie;
  }

  // Safe read-only HTTP methods do not require CSRF token validation
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Allow login endpoint (which obtains initial session)
  const fullPath = (req.originalUrl || req.path).split('?')[0];
  if (['/api/auth/login', '/login'].includes(fullPath) || ['/api/auth/login', '/login'].includes(req.path)) {
    return next();
  }

  // Allow API Token authentication (cPanel token / Bearer cptok_ / X-API-Key) to bypass CSRF
  let rawApiToken = null;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer cptok_') || authHeader.startsWith('Bearer ')) {
    const candidate = authHeader.slice(7).trim();
    if (candidate.startsWith('cptok_')) {
      rawApiToken = candidate;
    }
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
    if (validated) {
      req.user = validated.user;
      req.apiToken = validated.tokenRecord;
      req.isApiAuth = true;
      return next();
    }
  }

  // Check incoming CSRF token against cookie
  const bodyToken = (req.body && typeof req.body === 'object') ? req.body._csrf : null;
  const headerToken = req.headers['x-csrf-token'] || bodyToken;

  // Check session CSRF token if session exists
  let sessionCsrf = null;
  let sessionToken = (req.cookies && req.cookies.cpanel_session) ? req.cookies.cpanel_session : null;
  if (!sessionToken && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    sessionToken = req.headers.authorization.slice(7).trim();
  }
  if (sessionToken) {
    const session = panelDb.getSession(sessionToken);
    if (session && session.csrfToken) {
      sessionCsrf = session.csrfToken;
    }
  }

  const origin = req.headers.origin || req.headers.referer || '';
  const isSameOriginLocalhost = (req.headers['sec-fetch-site'] === 'same-origin') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1');

  const isValid = (headerToken && (headerToken === csrfCookie || headerToken === sessionCsrf)) ||
    (isSameOriginLocalhost && !headerToken);

  if (!isValid) {
    return res.status(403).json({
      error: 'Invalid or missing CSRF token. Request blocked for security.'
    });
  }

  next();
}

module.exports = {
  csrfMiddleware,
  generateCsrfToken
};
