// ==========================================================================
// cPanel Web Terminal Console
// ==========================================================================

const terminalApp = {
  history: [],
  historyIndex: -1,

  init() {
    this.setupListeners();
  },

  async open() {
    cPanelApp.openModal('modal-terminal');
    const input = document.getElementById('terminal-command-input');
    if (input) {
      setTimeout(() => input.focus(), 150);
    }
  },

  async executeCommand(cmd) {
    const raw = cmd.trim();
    if (!raw) return;

    this.history.push(raw);
    this.historyIndex = this.history.length;

    const historyBox = document.getElementById('terminal-history');
    const promptText = document.getElementById('terminal-prompt-text').textContent;

    if (raw === 'clear') {
      historyBox.innerHTML = '';
      return;
    }

    historyBox.innerHTML += `<div><span style="color:#38bdf8;">${promptText}</span> ${raw}</div>`;

    try {
      const res = await cPanelApp.api('/api/terminal/exec', {
        method: 'POST',
        body: { command: raw }
      });

      if (res.output) {
        historyBox.innerHTML += `<div style="color:${res.exitCode === 0 ? '#10b981' : '#ef4444'}; margin-bottom:8px;">${res.output}</div>`;
      }

      // Update prompt path
      const relCwd = res.cwd.split('\\').pop() || res.cwd;
      document.getElementById('terminal-prompt-text').textContent = `admin@localhost [~/${relCwd}]# `;

    } catch (err) {
      historyBox.innerHTML += `<div style="color:#ef4444; margin-bottom:8px;">Error: ${err.message}</div>`;
    }

    const termWindow = document.getElementById('terminal-window');
    termWindow.scrollTop = termWindow.scrollHeight;
  },

  setupListeners() {
    const input = document.getElementById('terminal-command-input');
    if (!input) return;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = input.value;
        input.value = '';
        this.executeCommand(val);
      } else if (e.key === 'ArrowUp') {
        if (this.history.length > 0 && this.historyIndex > 0) {
          this.historyIndex--;
          input.value = this.history[this.historyIndex] || '';
        }
      } else if (e.key === 'ArrowDown') {
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          input.value = this.history[this.historyIndex] || '';
        } else {
          this.historyIndex = this.history.length;
          input.value = '';
        }
      }
    });

    const termWin = document.getElementById('terminal-window');
    if (termWin) {
      termWin.addEventListener('click', () => input.focus());
    }
  }
};

window.terminalApp = terminalApp;
document.addEventListener('DOMContentLoaded', () => terminalApp.init());
