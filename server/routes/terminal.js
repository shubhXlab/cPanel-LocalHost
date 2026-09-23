const express = require('express');
const router = express.Router();
const terminalService = require('../services/terminalService');
const panelDb = require('../database/panelDb');

// Execute terminal command
router.post('/exec', async (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.json({ output: '', cwd: terminalService.getCwd(), exitCode: 0 });
  }

  try {
    const result = await terminalService.runCommand(command);
    panelDb.logAction('TERMINAL_COMMAND', `Command: ${command.slice(0, 100)}`, req.user ? req.user.id : 'system', req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current working directory
router.get('/cwd', (req, res) => {
  res.json({ cwd: terminalService.getCwd() });
});

module.exports = router;
