const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const panelDb = require('../database/panelDb');
const { recordFailedLogin, clearFailedLogins, loginRateLimiter } = require('../middleware/rateLimiter');
const { generateCsrfToken } = require('../middleware/csrf');

// Return CSRF token
router.get('/csrf-token', (req, res) => {
  let token = req.cookies ? req.cookies.cpanel_csrf : null;
  if (!token) {
    token = generateCsrfToken();
    res.cookie('cpanel_csrf', token, {
      httpOnly: false,
      sameSite: 'strict',
      maxAge: 86400000
    });
  }
  res.json({ csrfToken: token });
});

// Login (Pass-through / direct localhost mode)
router.post('/login', async (req, res) => {
  const { username } = req.body || {};
  let user = (username ? panelDb.getUserByUsername(username) : null) || panelDb.getUserByUsername('admin') || {
    id: 'admin',
    username: 'admin',
    email: 'admin@localhost',
    role: 'admin'
  };

  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  let sessionToken = req.cookies?.cpanel_session;
  if (!sessionToken) {
    try {
      sessionToken = panelDb.createSession(user.id, ip, req.headers['user-agent'] || '');
      res.cookie('cpanel_session', sessionToken, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 365 * 24 * 3600 * 1000
      });
    } catch (e) {
      sessionToken = 'localhost_admin_session';
    }
  }

  const sessionRecord = panelDb.getSession(sessionToken);

  res.json({
    success: true,
    message: 'Direct localhost session active.',
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      lastLogin: user.lastLogin,
      twoFactorEnabled: false
    },
    sessionToken,
    csrfToken: sessionRecord ? sessionRecord.csrfToken : (req.cookies?.cpanel_csrf || generateCsrfToken())
  });
});

// Logout
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Localhost session active (login disabled).' });
});

// Get Current User Profile (Direct Localhost Access)
router.get('/me', (req, res) => {
  const user = req.user || panelDb.getUserByUsername('admin') || {
    id: 'admin',
    username: 'admin',
    email: 'admin@localhost',
    role: 'admin',
    twoFactorEnabled: false
  };
  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      lastLogin: user.lastLogin,
      twoFactorEnabled: user.twoFactorEnabled
    }
  });
});

// Change Password
router.post('/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const user = panelDb.getUserById(req.user.id);
  const isMatch = bcrypt.compareSync(currentPassword, user.passwordHash);
  if (!isMatch) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const newHash = bcrypt.hashSync(newPassword, salt);
  panelDb.updateUser(user.id, { passwordHash: newHash });
  panelDb.logAction('PASSWORD_CHANGED', `User ${user.username} changed master password`, user.id, req.ip);

  res.json({ success: true, message: 'Password updated successfully.' });
});

// Setup 2FA
router.post('/2fa/setup', async (req, res) => {
  const user = panelDb.getUserById(req.user.id);
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.username, 'Localhost cPanel', secret);

  try {
    const qrDataUrl = await qrcode.toDataURL(otpauth);
    // Temporary store secret for verification
    panelDb.updateUser(user.id, { tempTwoFactorSecret: secret });

    res.json({
      secret,
      qrDataUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code for 2FA.' });
  }
});

// Verify & Enable/Disable 2FA
router.post('/2fa/verify', (req, res) => {
  const { code, enable } = req.body;
  const user = panelDb.getUserById(req.user.id);

  if (enable) {
    const secret = user.tempTwoFactorSecret;
    if (!secret) {
      return res.status(400).json({ error: 'Please initiate 2FA setup first.' });
    }
    const isValid = authenticator.check(code, secret);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid authentication code. Please try again.' });
    }

    panelDb.updateUser(user.id, {
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      tempTwoFactorSecret: null
    });
    panelDb.logAction('2FA_ENABLED', `User ${user.username} enabled 2FA`, user.id, req.ip);

    return res.json({ success: true, message: 'Two-Factor Authentication is now enabled!' });
  } else {
    // Disable
    panelDb.updateUser(user.id, {
      twoFactorEnabled: false,
      twoFactorSecret: null
    });
    panelDb.logAction('2FA_DISABLED', `User ${user.username} disabled 2FA`, user.id, req.ip);
    return res.json({ success: true, message: 'Two-Factor Authentication has been disabled.' });
  }
});

module.exports = router;
