const config = require('../config');

// In-memory tracker: ip -> { attempts, lockedUntil }
const loginAttempts = new Map();

function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const record = loginAttempts.get(ip);

  if (record) {
    if (record.lockedUntil && record.lockedUntil > Date.now()) {
      const waitMinutes = Math.ceil((record.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        error: `Security Lockout: Too many failed login attempts. Try again in ${waitMinutes} minute(s).`
      });
    }

    // Reset if lockout period has expired
    if (record.lockedUntil && record.lockedUntil <= Date.now()) {
      loginAttempts.delete(ip);
    }
  }

  next();
}

function recordFailedLogin(ip) {
  const record = loginAttempts.get(ip) || { attempts: 0, lockedUntil: null };
  record.attempts += 1;

  if (record.attempts >= config.maxLoginAttempts) {
    record.lockedUntil = Date.now() + (config.lockoutMinutes * 60 * 1000);
  }

  loginAttempts.set(ip, record);
}

function clearFailedLogins(ip) {
  loginAttempts.delete(ip);
}

module.exports = {
  loginRateLimiter,
  recordFailedLogin,
  clearFailedLogins
};
