const { exec } = require('child_process');
const path = require('path');
const config = require('../config');

let currentCwd = path.resolve(config.xampp.htdocs);

const FORBIDDEN_COMMANDS = [
  'format',
  'diskpart',
  'rmdir /s /q c:\\',
  'del /f /s /q c:\\windows',
  'shutdown',
  'reg delete'
];

const terminalService = {
  getCwd() {
    return currentCwd;
  },

  async runCommand(commandLine) {
    const rawCmd = (commandLine || '').trim();
    if (!rawCmd) return { output: '', cwd: currentCwd, exitCode: 0 };

    // Security check
    const lower = rawCmd.toLowerCase();
    for (const f of FORBIDDEN_COMMANDS) {
      if (lower.includes(f)) {
        return {
          output: `Command rejected by cPanel Security Shield: "${f}" is restricted.`,
          cwd: currentCwd,
          exitCode: 1
        };
      }
    }

    // Handle 'cd' command internally to track state
    if (lower.startsWith('cd ') || lower === 'cd') {
      const targetDir = rawCmd.slice(3).trim();
      if (!targetDir) {
        return { output: currentCwd, cwd: currentCwd, exitCode: 0 };
      }
      const fs = require('fs');
      const newPath = path.resolve(currentCwd, targetDir);
      try {
        if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
          currentCwd = newPath;
          return { output: '', cwd: currentCwd, exitCode: 0 };
        }
        return { output: `The system cannot find the path specified: ${targetDir}`, cwd: currentCwd, exitCode: 1 };
      } catch (err) {
        return { output: `The system cannot find the path specified: ${targetDir}`, cwd: currentCwd, exitCode: 1 };
      }
    }

    return new Promise((resolve) => {
      exec(rawCmd, { cwd: currentCwd, timeout: 30000, windowsHide: true }, (err, stdout, stderr) => {
        let output = stdout || '';
        if (stderr) output += (output ? '\n' : '') + stderr;
        if (err && !output) output = err.message;

        resolve({
          output: output.trim(),
          cwd: currentCwd,
          exitCode: err ? (err.code || 1) : 0
        });
      });
    });
  }
};

module.exports = terminalService;
