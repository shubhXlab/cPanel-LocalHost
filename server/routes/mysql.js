const express = require('express');
const router = express.Router();
const mysqlService = require('../services/mysqlService');
const panelDb = require('../database/panelDb');

// List databases
router.get('/databases', async (req, res) => {
  try {
    const data = await mysqlService.listDatabases();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create database
router.post('/databases', async (req, res) => {
  const { name, collation } = req.body;
  try {
    const result = await mysqlService.createDatabase(name, collation);
    panelDb.logAction('CREATE_DATABASE', `Created MySQL database: ${name}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Drop database
router.delete('/databases/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const result = await mysqlService.dropDatabase(name);
    panelDb.logAction('DROP_DATABASE', `Dropped MySQL database: ${name}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Check database
router.post('/databases/:name/check', async (req, res) => {
  const { name } = req.params;
  try {
    const result = await mysqlService.checkDatabase(name);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Repair database
router.post('/databases/:name/repair', async (req, res) => {
  const { name } = req.params;
  try {
    const result = await mysqlService.repairDatabase(name);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List users
router.get('/users', async (req, res) => {
  try {
    const data = await mysqlService.listUsers();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user
router.post('/users', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await mysqlService.createUser(username, password);
    panelDb.logAction('CREATE_MYSQL_USER', `Created MySQL user: ${username}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Drop user
router.delete('/users/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const result = await mysqlService.dropUser(name);
    panelDb.logAction('DROP_MYSQL_USER', `Dropped MySQL user: ${name}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Change user password
router.post('/users/:name/password', async (req, res) => {
  const { name } = req.params;
  const { newPassword } = req.body;
  try {
    const result = await mysqlService.changeUserPassword(name, newPassword);
    panelDb.logAction('CHANGE_MYSQL_USER_PASSWORD', `Changed password for user: ${name}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get user privileges
router.get('/privileges/:username/:database', async (req, res) => {
  const { username, database } = req.params;
  try {
    const result = await mysqlService.getUserPrivileges(username, database);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set user privileges
router.post('/privileges', async (req, res) => {
  const { username, database, privileges } = req.body;
  try {
    const result = await mysqlService.setUserPrivileges(username, database, privileges);
    panelDb.logAction('SET_PRIVILEGES', `Updated privileges for ${username} on ${database}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Revoke user from database
router.post('/privileges/revoke', async (req, res) => {
  const { username, database } = req.body;
  try {
    const result = await mysqlService.revokeUserFromDb(username, database);
    panelDb.logAction('REVOKE_PRIVILEGES', `Revoked user ${username} from ${database}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Remote MySQL Endpoints ---

// List Remote Access Hosts
router.get('/remote-hosts', async (req, res) => {
  try {
    const data = await mysqlService.listRemoteHosts();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Remote Access Host
router.post('/remote-hosts', async (req, res) => {
  const { host, comment } = req.body;
  try {
    const result = await mysqlService.addRemoteHost(host, comment);
    panelDb.logAction('ADD_REMOTE_MYSQL_HOST', `Added Remote MySQL Access Host: ${host}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Remote Access Host
router.delete('/remote-hosts/:host', async (req, res) => {
  const { host } = req.params;
  try {
    const result = await mysqlService.removeRemoteHost(host);
    panelDb.logAction('REMOVE_REMOTE_MYSQL_HOST', `Removed Remote MySQL Access Host: ${host}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
