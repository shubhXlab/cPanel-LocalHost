/**
 * cPanel Localhost - Landing & Download Page Logic
 * Interactive Terminal Simulator, OS Auto-Detection, Tabbed Showcase, Modals & Copy Utilities
 */

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initOSDetection();
  initShowcaseTabs();
  initTerminalSimulator();
  initCopyButtons();
  initFaqAccordion();
  initModals();
  initDownloadTriggers();
});

/* ==========================================================================
   1. Theme Management (Dark / Light with LocalStorage)
   ========================================================================== */
function initTheme() {
  const themeToggle = document.getElementById("themeToggle");
  const storedTheme = localStorage.getItem("cp_theme") || "dark";

  applyTheme(storedTheme);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(newTheme);
      localStorage.setItem("cp_theme", newTheme);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const themeIcon = document.getElementById("themeIcon");
  if (themeIcon) {
    if (theme === "light") {
      themeIcon.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>`;
    } else {
      themeIcon.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>`;
    }
  }
}

/* ==========================================================================
   2. Client OS Detection
   ========================================================================== */
function initOSDetection() {
  const osBadge = document.getElementById("osDetectedBadge");
  const heroDownloadBtn = document.getElementById("heroPrimaryDownload");
  const userAgent = window.navigator.userAgent.toLowerCase();

  let osName = "Windows 64-bit";
  let isWindows = true;

  if (userAgent.includes("win")) {
    osName = "Windows 10 / 11 (64-bit)";
    isWindows = true;
  } else if (userAgent.includes("mac")) {
    osName = "macOS (Via Docker / Node)";
    isWindows = false;
  } else if (userAgent.includes("linux")) {
    osName = "Linux (Via Node / Docker)";
    isWindows = false;
  }

  if (osBadge) {
    osBadge.innerHTML = `
      <span class="badge-dot"></span>
      Detected: <strong>${osName}</strong>
    `;
    if (!isWindows) {
      osBadge.classList.remove("green");
      osBadge.classList.add("blue");
    }
  }

  if (heroDownloadBtn && !isWindows) {
    heroDownloadBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      Download Source / Node Package
    `;
  }
}

/* ==========================================================================
   3. Tabbed Showcase & Screenshot Switcher
   ========================================================================== */
const SHOWCASE_URLS = {
  dashboard: "http://localhost:2083/index.html",
  files: "http://localhost:2083/files.html",
  databases: "http://localhost:2083/databases.html",
  domains: "http://localhost:2083/domains.html",
  api: "http://localhost:2083/api.html"
};

function initShowcaseTabs() {
  const tabs = document.querySelectorAll(".showcase-tab");
  const panels = document.querySelectorAll(".showcase-panel");
  const addressUrl = document.getElementById("mockupAddressUrl");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-target");

      // Activate Tab
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      // Activate Panel
      panels.forEach(p => p.classList.remove("active"));
      const activePanel = document.getElementById(`panel-${target}`);
      if (activePanel) {
        activePanel.classList.add("active");
      }

      // Update Simulated Browser Address Bar
      if (addressUrl && SHOWCASE_URLS[target]) {
        addressUrl.textContent = SHOWCASE_URLS[target];
      }
    });
  });
}

/* ==========================================================================
   4. Interactive Terminal Simulator
   ========================================================================== */
const TERMINAL_COMMANDS = {
  help: () => `
<div class="term-info">⚡ cPanel Localhost v1.0.0 CLI Command Center</div>
<div class="term-dim">Available interactive commands:</div>
  <span class="term-prompt">status</span>         - Display status of XAMPP, Apache, MySQL & cPanel Daemon
  <span class="term-prompt">vhost list</span>     - List all registered virtual hosts & local domains
  <span class="term-prompt">vhost add &lt;dom&gt;</span>  - Provision a new virtual host (e.g. 'vhost add api.test')
  <span class="term-prompt">token create</span>   - Generate an Autonomous AI REST Bearer API Token
  <span class="term-prompt">php -v</span>         - Check bundled PHP interpreter version
  <span class="term-prompt">mysql</span>          - Test local MariaDB / MySQL connectivity
  <span class="term-prompt">download</span>       - Trigger instant download of cPanel-Localhost.exe
  <span class="term-prompt">version</span>        - Show build version and academic metadata
  <span class="term-prompt">clear</span>          - Clear the terminal console
`,

  status: () => `
<div class="term-success">[OK] cPanel Localhost Daemon: RUNNING on PID 11988</div>
  ├─ Web Interface:    <span class="term-info">http://localhost:2083</span> (SSL / Jupiter Theme)
  ├─ HTTP Fallback:    <span class="term-info">http://localhost:2082</span>
  ├─ Apache Server:    <span class="term-success">RUNNING</span> on Port 80 (v2.4.58 Win64)
  ├─ MariaDB/MySQL:    <span class="term-success">RUNNING</span> on Port 3306 (10.4.32-MariaDB)
  ├─ XAMPP Root:       <span class="term-dim">C:\\xampp</span> [Auto-Discovered]
  └─ AI Gateway:       <span class="term-info">ENABLED</span> (OpenAPI 3.0 / Bearer Auth Ready)
`,

  "vhost list": () => `
<div class="term-info">Active Virtual Hosts in Apache httpd-vhosts.conf:</div>
  1. <span class="term-success">localhost</span>       -> C:\\xampp\\htdocs (Default)
  2. <span class="term-success">project1.test</span>   -> C:\\xampp\\htdocs\\project1
  3. <span class="term-success">api.portal.local</span> -> C:\\xampp\\htdocs\\api
  4. <span class="term-success">wordpress.test</span>  -> C:\\xampp\\htdocs\\wp-site
<div class="term-dim">Total: 4 domains active with instant DNS loopback.</div>
`,

  "token create": () => {
    const fakeToken = "cptok_" + Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join("");
    return `
<div class="term-success">✔ AI Bearer API Token successfully generated!</div>
  Token:  <span class="term-prompt">${fakeToken}</span>
  Scopes: [file_manager, mysql_orchestration, vhost_sync, cron_scheduler]
  Format: Authorization: Bearer ${fakeToken}
<div class="term-dim">AI Agents (Cursor, Claude, ChatGPT Actions) can now manage this server programmatically!</div>
`;
  },

  "php -v": () => `
<div class="term-info">PHP 8.2.12 (cli) (built: Oct 24 2023 21:15:15) (NTS Visual C++ 2019 x64)</div>
Copyright (c) The PHP Group
Zend Engine v4.2.12, with Zend OPcache v8.2.12
`,

  mysql: () => `
<div class="term-success">Connecting to MariaDB 10.4.32-MariaDB on localhost:3306...</div>
Server version: 10.4.32-MariaDB - mariadb.org binary distribution
Connection ID: 48
SSL: Not in use (Local loopback)
Current User: root@localhost
Uptime: 2 days 14 hours 22 min 10 sec
`,

  version: () => `
<div class="term-info">cPanel Localhost (Single-File Binary Edition)</div>
Version:       1.0.0 Stable
Architecture:  x86_64 Windows
Developer:     Shubham Ramjiyani (ACBCS, Nashik)
License:       MIT License
`,

  download: () => {
    triggerDownload("cPanel-Localhost.exe");
    return `<div class="term-success">🚀 Download initiated: cPanel-Localhost.exe (132 MB)</div>`;
  }
};

function initTerminalSimulator() {
  const termBody = document.getElementById("terminalBody");
  const termInput = document.getElementById("terminalInput");
  const chips = document.querySelectorAll(".cmd-chip");

  if (!termInput || !termBody) return;

  function appendLine(htmlContent) {
    const line = document.createElement("div");
    line.className = "term-line";
    line.innerHTML = htmlContent;
    termBody.appendChild(line);
    termBody.scrollTop = termBody.scrollHeight;
  }

  function executeCommand(rawCmd) {
    const cmd = rawCmd.trim();
    if (!cmd) return;

    // Echo input
    appendLine(`<span class="term-prompt">C:\\cPanel-Localhost&gt;</span> <span style="color:#fff">${escapeHtml(cmd)}</span>`);

    const lowerCmd = cmd.toLowerCase();

    if (lowerCmd === "clear") {
      termBody.innerHTML = `
        <div class="term-line term-dim">Terminal cleared. Type <span class="term-prompt">help</span> for commands.</div>
      `;
      return;
    }

    if (lowerCmd.startsWith("vhost add")) {
      const parts = cmd.split(" ");
      const domainName = parts[2] || "mysite.test";
      appendLine(`
        <div class="term-info">Configuring virtual host for '${escapeHtml(domainName)}'...</div>
        <div>  ├─ Allocating document root: C:\\xampp\\htdocs\\${escapeHtml(domainName.split('.')[0])}</div>
        <div>  ├─ Appending to C:\\xampp\\apache\\conf\\extra\\httpd-vhosts.conf</div>
        <div>  ├─ Updating Windows hosts file: 127.0.0.1 ${escapeHtml(domainName)}</div>
        <div class="term-success">✔ Virtual Host '${escapeHtml(domainName)}' is LIVE at http://${escapeHtml(domainName)}</div>
      `);
      return;
    }

    if (TERMINAL_COMMANDS[lowerCmd]) {
      appendLine(TERMINAL_COMMANDS[lowerCmd]());
    } else {
      appendLine(`
        <div class="term-warn">'${escapeHtml(cmd)}' is not recognized. Type <span class="term-prompt">help</span> to view supported commands.</div>
      `);
    }
  }

  termInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const val = termInput.value;
      termInput.value = "";
      executeCommand(val);
    }
  });

  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      const cmd = chip.getAttribute("data-cmd");
      if (cmd) {
        termInput.value = cmd;
        termInput.focus();
        executeCommand(cmd);
      }
    });
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ==========================================================================
   5. Copy Utilities & Toast
   ========================================================================== */
function initCopyButtons() {
  const copyButtons = document.querySelectorAll(".copy-btn");

  copyButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const targetText = btn.getAttribute("data-copy");
      if (!targetText) return;

      try {
        await navigator.clipboard.writeText(targetText);
        showToast("Copied to clipboard!");

        const originalHtml = btn.innerHTML;
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Copied!
        `;
        btn.style.color = "var(--accent-green)";
        btn.style.borderColor = "var(--accent-green)";

        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.style.color = "";
          btn.style.borderColor = "";
        }, 2000);
      } catch (err) {
        showToast("Press Ctrl+C to copy");
      }
    });
  });
}

function showToast(message) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast-notification";
    document.body.appendChild(toast);
  }

  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    <span>${message}</span>
  `;

  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

/* ==========================================================================
   6. FAQ Accordion
   ========================================================================== */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach(item => {
    const question = item.querySelector(".faq-question");
    if (question) {
      question.addEventListener("click", () => {
        const isActive = item.classList.contains("active");

        // Close all others
        faqItems.forEach(i => i.classList.remove("active"));

        if (!isActive) {
          item.classList.add("active");
        }
      });
    }
  });
}

/* ==========================================================================
   7. Modals: Deploy Guide & Getting Started
   ========================================================================== */
function initModals() {
  // cPanel Deploy Guide Modal
  const openDeployBtn = document.getElementById("openDeployGuideBtn");
  const navDeployBtn = document.getElementById("navDeployGuideBtn");
  const deployModal = document.getElementById("deployModal");
  const closeDeployBtn = document.getElementById("closeDeployModal");

  function openDeploy() {
    if (deployModal) deployModal.classList.add("active");
  }

  function closeDeploy() {
    if (deployModal) deployModal.classList.remove("active");
  }

  if (openDeployBtn) openDeployBtn.addEventListener("click", openDeploy);
  if (navDeployBtn) navDeployBtn.addEventListener("click", openDeploy);
  if (closeDeployBtn) closeDeployBtn.addEventListener("click", closeDeploy);

  if (deployModal) {
    deployModal.addEventListener("click", (e) => {
      if (e.target === deployModal) closeDeploy();
    });
  }

  // Deploy Modal Sub-Tabs
  const deployTabs = document.querySelectorAll(".deploy-tab-btn");
  const deployPanels = document.querySelectorAll(".deploy-content-panel");

  deployTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-deploy-target");
      deployTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      deployPanels.forEach(p => p.classList.remove("active"));
      const p = document.getElementById(`deploy-${target}`);
      if (p) p.classList.add("active");
    });
  });

  // Getting Started / Download Modal
  const startModal = document.getElementById("startModal");
  const closeStartBtn = document.getElementById("closeStartModal");

  if (closeStartBtn && startModal) {
    closeStartBtn.addEventListener("click", () => {
      startModal.classList.remove("active");
    });
    startModal.addEventListener("click", (e) => {
      if (e.target === startModal) startModal.classList.remove("active");
    });
  }
}

/* ==========================================================================
   8. Download Triggers
   ========================================================================== */
function initDownloadTriggers() {
  const downloadButtons = document.querySelectorAll("[data-download-file]");

  downloadButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const filename = btn.getAttribute("data-download-file") || "cPanel-Localhost.exe";
      triggerDownload(filename);
    });
  });
}

function triggerDownload(filename) {
  // Create virtual link to trigger download
  const link = document.createElement("a");
  link.href = filename;
  link.download = filename;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Show "Getting Started" guidance modal
  const startModal = document.getElementById("startModal");
  if (startModal) {
    const filenameEl = document.getElementById("downloadingFilename");
    if (filenameEl) filenameEl.textContent = filename;
    startModal.classList.add("active");
  }

  showToast(`Downloading ${filename}...`);
}
