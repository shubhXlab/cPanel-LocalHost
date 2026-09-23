# 📋 SETUP.md — cPanel-LocalHost Complete Setup Guide

> **This document covers every installation method** — from the one-click Windows installer, to the full developer source setup, to AI agent integration.

---

## 📑 Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Method A — One-Click Windows Installer (Recommended)](#2-method-a--one-click-windows-installer-recommended)
3. [Method B — Run from Source (Developer Mode)](#3-method-b--run-from-source-developer-mode)
4. [Environment Configuration](#4-environment-configuration)
5. [First Login](#5-first-login)
6. [Module Quick Reference](#6-module-quick-reference)
7. [API Token & AI Agent Setup](#7-api-token--ai-agent-setup)
8. [Building the Executable from Source](#8-building-the-executable-from-source)
9. [Running Tests](#9-running-tests)
10. [Troubleshooting](#10-troubleshooting)
11. [Uninstall](#11-uninstall)

---

## 1. System Requirements

| Requirement | Minimum | Recommended |
|---|---|---|
| **OS** | Windows 10 (64-bit) | Windows 11 (64-bit) |
| **RAM** | 2 GB free | 4 GB+ free |
| **Disk Space** | 500 MB free | 1 GB+ free |
| **Node.js** *(source only)* | v18.0.0 | v20 LTS |
| **XAMPP** *(optional)* | v8.x | v8.2+ |
| **Browser** | Chrome 90+ / Edge 90+ / Firefox 90+ | Chrome / Edge (latest) |

> [!NOTE]
> The standalone `cPanel-Localhost.exe` bundles its own Node.js runtime and a portable XAMPP stack — **no external software is required** for Method A.

---

## 2. Method A — One-Click Windows Installer (Recommended)

This is the **easiest way** to get started. One double-click is all you need.

### 2.1 Download the Distribution Package

Download the latest release from GitHub:

📦 **[https://github.com/shubhXlab/cPanel-LocalHost/releases/latest](https://github.com/shubhXlab/cPanel-LocalHost/releases/latest)**

Make sure all three files are in the **same folder**:

```
📁 cPanel-LocalHost/
├── cPanel-Localhost.exe           ← Main application (~132 MB)
├── scripts/
│   └── cpanel-localhost-cert.cer  ← SSL Trust Certificate
└── Install-and-Run.bat            ← One-click setup launcher
```

### 2.2 Run the Installer

1. **Double-click** `Install-and-Run.bat`.
2. A **UAC (User Account Control)** dialog will appear — click **Yes**.
3. The installer will:
   - ✅ Detect if the SSL certificate is already trusted (skips if already done).
   - ✅ Install `cpanel-localhost-cert.cer` to your Windows **Trusted Root Certification Authorities** store.
   - ✅ Launch `cPanel-Localhost.exe`.
   - ✅ Automatically open **http://localhost:2083** in your browser.

> [!IMPORTANT]
> The certificate installation only happens **once**. Every subsequent run of `Install-and-Run.bat` (or directly running `cPanel-Localhost.exe`) skips the cert step automatically.

### 2.3 What the Installer Does (Detailed)

```
Step 0 → Detects if running as Administrator. If not, re-launches with UAC elevation.
Step 1 → Resolves all paths relative to the bat file location (portable — works from USB too).
Step 2 → Validates cPanel-Localhost.exe and the cert file exist before proceeding.
Step 3 → Reads the certificate thumbprint and checks if it's already in the Trusted Root store.
         → If already present: skips silently.
         → If missing: runs certutil -addstore -f "ROOT" to install it.
Step 4 → Launches cPanel-Localhost.exe in the background.
Step 5 → Waits 4 seconds, then opens http://localhost:2083 in your default browser.
```

### 2.4 Manual Certificate Verification (Optional)

To confirm the certificate is installed correctly, open **PowerShell** and run:

```powershell
Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*cpanel-localhost*" }
```

You should see an entry with your certificate's subject name.

### 2.5 Verify the Executable Integrity

Before running, you can verify the downloaded file hasn't been tampered with:

```powershell
Get-FileHash .\cPanel-Localhost.exe -Algorithm SHA256
```

**Expected SHA-256:**
```
A4B97ED3D4D3D2BED7FDF9CB01DDE2F3F034DFE2483083164CACB0EBB0FD23FB
```

---

## 3. Method B — Run from Source (Developer Mode)

Use this method if you want to modify the code, contribute, or run on a system with existing Node.js and XAMPP.

### 3.1 Prerequisites

Install the following before proceeding:

- **Node.js v18+** → [https://nodejs.org](https://nodejs.org)
- **XAMPP** (Apache + MySQL) → [https://www.apachefriends.org](https://www.apachefriends.org)
- **Git** → [https://git-scm.com](https://git-scm.com)

### 3.2 Clone the Repository

```bash
git clone https://github.com/shubhXlab/cPanel-LocalHost.git
cd cPanel-LocalHost
```

### 3.3 Install Dependencies

```bash
npm install
```

### 3.4 Configure Environment

Copy the example environment file:

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Edit `.env` with your preferences:

```env
# Server Configuration
PORT=2083
HOST=localhost
AUTO_START_SERVICES=true

# XAMPP Path (only needed if XAMPP is not in the standard location)
# XAMPP_PATH=C:/xampp
```

### 3.5 Start the Server

**Production mode:**
```bash
npm start
```

**Development mode (auto-restart on file changes):**
```bash
npm run dev
```

### 3.6 Open the Dashboard

Navigate to: **[http://localhost:2083](http://localhost:2083)**

> [!TIP]
> If port `2083` is in use, the server automatically falls back to port `2082`. Check the console output for the actual URL.

---

## 4. Environment Configuration

All settings are controlled via the `.env` file in the project root.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `2083` | The port the dashboard runs on (fallback: `2082`) |
| `HOST` | `localhost` | The network interface to bind to |
| `AUTO_START_SERVICES` | `true` | Automatically start Apache and MySQL on boot |
| `XAMPP_PATH` | `C:/xampp` | Override XAMPP installation path |
| `SESSION_SECRET` | *(auto-generated)* | Secret for session signing (set a fixed value for production) |
| `CSRF_SECRET` | *(auto-generated)* | Secret for CSRF token signing |

> [!WARNING]
> In production or shared environments, always set `SESSION_SECRET` and `CSRF_SECRET` to fixed, long random strings. Auto-generated values reset on each restart, which invalidates all active sessions.

---

## 5. First Login

1. Open **[http://localhost:2083](http://localhost:2083)**.
2. Log in with the default admin credentials:

   | Field | Default Value |
   |---|---|
   | **Username** | `admin` |
   | **Password** | `admin` |

3. **Change your password immediately** after first login via **Security → Change Password**.

> [!CAUTION]
> The default password is stored in the local data store. It is not exposed externally since the server only binds to `localhost` by default, but you should change it regardless.

---

## 6. Module Quick Reference

Once logged in, the dashboard is organized into the following modules:

| Module | URL | Description |
|---|---|---|
| **Dashboard** | `/` | System overview, service status, quick-launch grid |
| **File Manager** | `/files.html` | Browse, upload, edit, and manage all files in document roots |
| **Code Editor** | `/editor.html` | Full in-browser code editor with syntax highlighting |
| **Databases** | `/databases.html` | Create/manage MySQL databases, users, and privileges |
| **Domains** | `/domains.html` | Manage virtual hosts, subdomains, and DNS Zone records |
| **Cron Jobs** | `/advanced.html` | Schedule tasks using standard 5-field Linux cron syntax |
| **Security** | `/security.html` | SSL/TLS certificates, IP blocklist, 2FA management |
| **Software** | `/software.html` | MultiPHP version selector, php.ini editor |
| **Metrics** | `/metrics.html` | Real-time CPU, RAM, disk, and network statistics |
| **API Tokens** | `/api.html` | Create Bearer tokens and access the AI Gateway |

### Service Controls

Start, stop, and restart Apache and MySQL directly from the Dashboard status panel, or use the XAMPP controls in the taskbar.

---

## 7. API Token & AI Agent Setup

cPanel-LocalHost includes a native **Autonomous AI Execution Gateway** allowing AI models (ChatGPT Custom GPT Actions, Claude, Cursor, LangChain, etc.) to manage your server programmatically.

### 7.1 Create an API Token

1. Go to **[http://localhost:2083/api.html](http://localhost:2083/api.html)**.
2. Click **"Create New Token"**.
3. Enter a **name** (e.g., `claude-agent`, `my-cursor-token`).
4. Select **permission scopes**:

   | Scope | Access |
   |---|---|
   | `*` | Full access to all modules |
   | `files` | File Manager (read, write, upload, archive) |
   | `mysql` | Databases (create, drop, users, privileges) |
   | `domains` | Virtual hosts and DNS Zone records |
   | `advanced` | Cron Jobs, error pages, network diagnostics |
   | `security` | SSL/TLS, IP blocklist, 2FA |
   | `software` | PHP version, `php.ini` settings |
   | `metrics` | System telemetry and logs |
   | `backups` | Create and restore backups |
   | `system` | Service health and XAMPP controls |
   | `terminal` | Execute shell commands (admin only) |

5. Set an optional expiry date.
6. Click **Create** — copy the token immediately (shown only once).

> [!CAUTION]
> API Tokens are hashed with SHA-256 and cannot be recovered after creation. Store the plaintext token in a password manager or secrets vault.

### 7.2 Connect to an AI Agent

**Authentication header:**
```http
Authorization: Bearer YOUR_API_TOKEN_HERE
```

**OpenAPI 3.0 Schema** (for Custom GPT Actions / LangChain tools):
```
GET http://localhost:2083/api/ai/openapi.json
```

**Universal Execution Gateway:**
```http
POST http://localhost:2083/api/ai/execute
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "module": "files",
  "action": "list",
  "params": {
    "dir": "/"
  }
}
```

### 7.3 Connect to ChatGPT Custom GPT

1. Open [ChatGPT → My GPTs → Create a GPT](https://chat.openai.com/gpts).
2. Go to **Actions → Add Action**.
3. Import schema from URL: `http://localhost:2083/api/ai/openapi.json`.
4. Set **Authentication** → **API Key** → paste your token.
5. Save and test — your GPT can now manage files, databases, and more directly.

### 7.4 Connect to Cursor

Add to your `.cursor/rules` or Cursor MCP config:

```json
{
  "name": "cPanel-LocalHost",
  "endpoint": "http://localhost:2083/api/ai/execute",
  "auth": {
    "type": "bearer",
    "token": "YOUR_API_TOKEN_HERE"
  }
}
```

---

## 8. Building the Executable from Source

If you want to rebuild `cPanel-Localhost.exe` from source:

### Prerequisites
- `.NET Framework 4.x` (for C# compiler `csc.exe` — already present on Windows 10/11)
- XAMPP installed at `C:\xampp` (or set `XAMPP_PATH` in `.env`)

### Build

```bat
:: Full all-in-one single exe (includes bundled XAMPP)
build_single_exe.bat
```

This runs `scripts/build_single_exe.js` which:
1. Packages the entire stack (Node.js, XAMPP, app source) into `payload.zip`.
2. Compiles the C# self-extracting launcher (`launcher/SingleFileLauncher.cs`) with `csc.exe`.
3. Appends `payload.zip` to the launcher binary → outputs `cPanel-Localhost.exe`.

> [!NOTE]
> The build takes 2–5 minutes depending on your machine. The output is `cPanel-Localhost.exe` (~132 MB) in the project root.

---

## 9. Running Tests

Run the full automated integration and end-to-end test suite:

```bash
# Make sure the server is running first
npm start

# In a second terminal
node test_cpanel_suite.js
```

The test suite covers:
- ✅ Server health and startup
- ✅ Authentication (login, session, CSRF)
- ✅ File Manager API (list, read, write)
- ✅ MySQL API (create database, user, privileges)
- ✅ Domains API (virtual host creation)
- ✅ API Token creation and bearer auth
- ✅ AI Gateway execution dispatcher

---

## 10. Troubleshooting

### Port Already in Use

**Symptom:** Server won't start, console shows `EADDRINUSE`.

**Fix:**
```powershell
# Find what's using port 2083
netstat -ano | findstr :2083

# Kill the process (replace PID)
taskkill /F /PID <PID>
```

Or change the port in `.env`:
```env
PORT=2084
```

---

### Dashboard Shows "Cannot Connect"

**Check:** Is the server actually running? Look for the startup message in the terminal:
```
🚀 LOCALHOST cPANEL IS RUNNING!
Dashboard URL: http://127.0.0.1:2083
```

**Fix:** The server may have fallen back to port `2082`. Try [http://localhost:2082](http://localhost:2082).

---

### MySQL Shows "STOPPED"

**Symptom:** The Dashboard shows MySQL as stopped.

**Fix:**
1. Open XAMPP Control Panel.
2. Click **Start** next to **MySQL**.
3. Or enable `AUTO_START_SERVICES=true` in `.env`.

---

### Certificate Not Trusted (Browser HTTPS Warning)

**Symptom:** Browser shows a security warning on HTTPS pages.

**Fix:** Re-run `Install-and-Run.bat` with administrator privileges. If the problem persists, manually install the cert:

```powershell
# Run as Administrator
certutil -addstore -f "ROOT" "scripts\cpanel-localhost-cert.cer"
```

Then restart your browser completely.

---

### File Manager Shows "Access Denied"

**Symptom:** Can't browse directories, getting 403 errors.

**Cause:** The file manager uses a chroot jail — it only allows access to whitelisted roots (`htdocs` and `data/vhosts`).

**Fix:** Ensure you're navigating within `C:\xampp\htdocs` or a configured document root. To add custom roots, edit `server/config/index.js` → `allowedRoots`.

---

### API Token Returns 403 Forbidden

**Symptom:** AI agent gets `403` when calling the API.

**Checklist:**
1. Confirm the token is passed as `Authorization: Bearer <token>` (not `Token` or `Basic`).
2. Confirm the token's scopes include the module you're trying to access.
3. Confirm the token has not expired.
4. Confirm the server is running and accessible on `localhost:2083`.

---

### `npm install` Fails

**Symptom:** Dependency errors during source setup.

**Fix:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rmdir /s /q node_modules
npm install
```

---

## 11. Uninstall

### Remove the Application
Simply delete the folder containing `cPanel-Localhost.exe` and the associated files. No registry entries are written.

### Remove the SSL Certificate

Open **PowerShell as Administrator** and run:

```powershell
$cert = Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*cpanel-localhost*" }
if ($cert) {
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root','LocalMachine')
    $store.Open('ReadWrite')
    $store.Remove($cert)
    $store.Close()
    Write-Output "Certificate removed successfully."
} else {
    Write-Output "Certificate not found."
}
```

### Remove the Data Store

If you ran in source mode and want to clean all stored data (users, sessions, tokens, domains):

```bash
# Deletes the local JSON database
del data\cpanel_store.json
```

---

## 📌 Quick Reference Card

```
Dashboard:      http://localhost:2083
File Manager:   http://localhost:2083/files.html
Databases:      http://localhost:2083/databases.html
API Tokens:     http://localhost:2083/api.html
OpenAPI Schema: http://localhost:2083/api/ai/openapi.json
AI Gateway:     POST http://localhost:2083/api/ai/execute

Default Login:  admin / admin
Server Start:   npm start
Dev Mode:       npm run dev
Tests:          node test_cpanel_suite.js
```

---

*For questions and issues, open a GitHub Issue at [https://github.com/shubhXlab/cPanel-LocalHost/issues](https://github.com/shubhXlab/cPanel-LocalHost/issues)*
