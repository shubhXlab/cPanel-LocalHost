# 🚀 Complete Guide: Creating a Subdomain and Hosting the Landing Page on cPanel

This comprehensive, step-by-step guide explains how to create a custom subdomain (e.g., `download.yourdomain.com`) and host the **cPanel Localhost** dynamic landing page and executable file on a live **cPanel** web hosting server.

---

## 📋 Table of Contents
1. [Overview & Prerequisites](#1-overview--prerequisites)
2. [Step 1: Create the Subdomain in cPanel](#step-1-create-the-subdomain-in-cpanel)
   - [Method A: Modern cPanel Jupiter Theme](#method-a-modern-cpanel-jupiter-theme-default)
   - [Method B: Classic cPanel Paper Lantern Theme](#method-b-classic-cpanel-paper-lantern-theme)
   - [Method C: Automated via cPanel Uploader CLI](#method-c-automated-via-cpanel-uploader-cli)
3. [Step 2: Configure DNS Records (Cloudflare / External DNS)](#step-2-configure-dns-records)
4. [Step 3: Issue Free SSL / TLS Certificate (AutoSSL)](#step-3-issue-free-ssl--tls-certificate-autossl)
5. [Step 4: Package and Upload the Landing Page](#step-4-package-and-upload-the-landing-page)
   - [Using package_deploy.bat + File Manager](#using-package_deploybat--cpanel-file-manager)
   - [Using cPanel Uploader Zip Deploy](#using-cpanel-uploader-high-speed-zip-deploy)
6. [Step 5: Hosting the 138MB Executable Binary](#step-5-hosting-the-138mb-executable-binary)
7. [Step 6: Apache .htaccess Verification & MIME Types](#step-6-apache-htaccess-verification--mime-types)
8. [Step 7: Verification & Testing Checklist](#step-7-verification--testing-checklist)
9. [Troubleshooting Common Issues](#troubleshooting-common-issues)

---

## 1. Overview & Prerequisites

### Server Architecture
- **Domain/Subdomain:** `download.yourdomain.com` (or `localhost.yourdomain.com`)
- **Document Root Directory:** `public_html/download` (isolated from your main site root)
- **Web Server:** Apache 2.4+ / LiteSpeed Web Server
- **Security:** Free Let's Encrypt / Sectigo SSL via AutoSSL

### Local Files Included
Your `cpanel-localhost/landing/` directory contains:
```
landing/
├── index.html                 # Complete landing page with interactive showcase & terminal
├── style.css                  # Responsive dark/light theme stylesheet
├── app.js                     # Dynamic JS (OS detection, terminal, download triggers)
├── config.js                  # Central configuration (version, download URLs, SHA256)
├── .htaccess                  # Apache rules (HTTPS redirect, .exe MIME headers, Gzip)
├── assets/
│   └── favicon.svg            # Scalable brand vector logo
├── DEPLOY_TO_CPANEL.md        # This guide
└── package_deploy.bat         # 1-click batch script to create deployable zip
```

---

## Step 1: Create the Subdomain in cPanel

### Method A: Modern cPanel Jupiter Theme (Default)
Most cPanel servers now run the **Jupiter** theme:

1. Log into your cPanel dashboard:
   ```
   https://yourdomain.com:2083
   ```
2. In the search bar at the top or under the **Domains** section, click **Domains**.
3. In the top-right corner of the Domains list, click the blue button:
   **`Create A New Domain`**.
4. In the configuration form:
   - **Domain:** Enter your subdomain, e.g.:
     ```
     download.yourdomain.com
     ```
   - **Share document root (`/home/username/public_html`) with “yourdomain.com”:**  
     ⚠️ **UNCHECK** this checkbox!
   - **Document Root (File System):**  
     Enter:
     ```
     public_html/download
     ```
     *(Or simply `download`, which places it outside `public_html`). Keeping it in `public_html/download` is standard.*
5. Click **Submit** (or **Submit and Create Another**).
6. cPanel will register the subdomain and create the directory `public_html/download`.

---

### Method B: Classic cPanel Paper Lantern Theme
If your cPanel host uses the classic **Paper Lantern** theme:

1. Log into cPanel.
2. Under the **Domains** section, click **Subdomains**.
3. Fill in:
   - **Subdomain:** `download`
   - **Domain:** Select `yourdomain.com` from the dropdown.
   - **Document Root:** Auto-populates to `public_html/download`.
4. Click **Create**.

---

### Method C: Automated via cPanel Uploader CLI
If you want to create the subdomain programmatically using the `cpanel uploader` tool included in this workspace:

1. Open your terminal in `cpanel uploader/`:
   ```powershell
   cd "c:\Users\shubh\OneDrive\Desktop\antigravity\cpanel uploader"
   ```
2. Run:
   ```bash
   python main.py domain create-subdomain --domain download --root-domain yourdomain.com --doc-root public_html/download
   ```
3. The CLI calls cPanel's native API and provisions the subdomain and folder instantly.

---

## Step 2: Configure DNS Records

### If using cPanel Default Nameservers:
cPanel automatically adds the DNS `A` record into your DNS Zone File. No further action is required!

### If using Cloudflare or External DNS (Namecheap, GoDaddy, Hostinger):
You must add a DNS record on your DNS provider's dashboard so `download.yourdomain.com` resolves to your cPanel hosting server:

1. Find your cPanel **Shared IP Address**:
   - Look in the right-hand **General Information** sidebar of cPanel: `Shared IP Address: 192.0.2.123` (example).
2. Go to your DNS provider (e.g. Cloudflare DNS):
   - **Record Type:** `A`
   - **Name:** `download` (or `localhost`)
   - **IPv4 Address:** `<Your cPanel Shared IP>`
   - **TTL:** `Auto` (or `300`)
   - **Proxy Status:**
     - *Recommendation:* If hosting the 138MB `.exe` directly on cPanel, set to **DNS Only** (Grey Cloud) because Cloudflare Free Tier has a 100MB single-request upload limit. If proxying through Cloudflare, use external CDN for the `.exe` file (see Step 5).

---

## Step 3: Issue Free SSL / TLS Certificate (AutoSSL)

To ensure visitors see `https://` with the secure green padlock:

1. In cPanel, navigate to **Security** &gt; **SSL/TLS Status**.
2. Find `download.yourdomain.com` in the list of domains.
3. Check the box next to `download.yourdomain.com`.
4. Click the blue button at the top: **`Run AutoSSL`**.
5. Wait 60–120 seconds. The badge will change to a green lock icon: **AutoSSL Domain Validated**.

*(Note: AutoSSL requires DNS propagation. Ensure Step 2 has resolved first).*

---

## Step 4: Package and Upload the Landing Page

### Using `package_deploy.bat` + cPanel File Manager

1. In your local workspace, double-click or run:
   ```cmd
   cpanel-localhost\landing\package_deploy.bat
   ```
   This generates: `cpanel-localhost\landing\landing-deploy.zip` containing all landing page files, assets, and `.htaccess`.

2. Open **cPanel** &gt; **File Manager**.
3. In the directory tree on the left, navigate to:
   ```
   public_html/download/
   ```
4. Click the **Upload** button in the top toolbar.
5. Drag and drop `landing-deploy.zip`.
6. Once the progress bar turns green (100%), return to the File Manager tab.
7. Right-click `landing-deploy.zip` and select **Extract** &gt; **Extract File(s)** into `public_html/download/`.
8. Delete `landing-deploy.zip` to keep the folder clean.
9. **Verify `.htaccess` is visible:**
   - In File Manager, click **Settings** (top-right gear icon).
   - Check **Show Hidden Files (dotfiles)** and click **Save**.
   - Confirm `.htaccess` is present in `public_html/download/`.

---

### Using cPanel Uploader High-Speed Zip Deploy
You can also deploy with a single terminal command from your workspace:

```bash
cd "c:\Users\shubh\OneDrive\Desktop\antigravity\cpanel uploader"
python main.py file zip-deploy --zip-file "../cpanel-localhost/landing/landing-deploy.zip" --remote-dir public_html/download
```
The script uploads the zip file via cPanel UAPI, executes remote extraction on the server, and cleans up the temporary zip file automatically!

---

## Step 5: Hosting the 138MB Executable Binary

`cPanel-Localhost.exe` is ~138 MB. You have two options for hosting the binary:

### Option A: Direct Self-Hosting on cPanel (Included by Default)
1. In cPanel **File Manager**, navigate to `public_html/download/`.
2. Click **Upload** and select `cPanel-Localhost.exe` from `cpanel-localhost\cPanel-Localhost.exe`.
3. Wait for the upload to complete.
4. The file will be accessible at:
   ```
   https://download.yourdomain.com/cPanel-Localhost.exe
   ```
5. The included `.htaccess` automatically sends `Content-Disposition: attachment` headers, causing browsers to download the file directly.

> [!TIP]
> **Increasing PHP / Web Limits if needed:**
> In cPanel, navigate to **Software** &gt; **MultiPHP INI Editor** &gt; select `download.yourdomain.com` &gt; set:
> - `upload_max_filesize = 512M`
> - `post_max_size = 512M`
> - `memory_limit = 512M`

### Option B: Remote CDN / GitHub Releases (Optional)
If you want to save shared hosting bandwidth:
1. Create a GitHub Release on your repository and attach `cPanel-Localhost.exe`.
2. Open `config.js` in `public_html/download/` and update:
   ```javascript
   downloads: {
     windowsExe: {
       filename: "cPanel-Localhost.exe",
       url: "https://github.com/shubham/cpanel-localhost/releases/download/v1.0.0/cPanel-Localhost.exe",
       ...
     }
   }
   ```

---

## Step 6: Apache .htaccess Verification & MIME Types

The included `.htaccess` file has been pre-configured specifically for cPanel Apache servers:

```apache
# 1. Force HTTPS
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} off
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>

# 2. Binary Executable MIME Types & Direct Download
<IfModule mod_mime.c>
  AddType application/octet-stream .exe
  AddType application/zip .zip
  AddType image/svg+xml .svg
</IfModule>

<IfModule mod_headers.c>
  <FilesMatch "\.(exe|zip)$">
    Header set Content-Disposition "attachment"
    Header set X-Content-Type-Options "nosniff"
  </FilesMatch>

  # Modern Security Headers
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set X-XSS-Protection "1; mode=block"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# 3. Gzip / Deflate Compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript application/json image/svg+xml
</IfModule>

# 4. Disable Directory Browsing
Options -Indexes
```

---

## Step 7: Verification & Testing Checklist

After completing the upload, test each component:

| Test Item | Verification Command / URL | Expected Outcome |
| :--- | :--- | :--- |
| **HTTPS Redirection** | `http://download.yourdomain.com` | Automatically redirects to `https://` with status 301 |
| **SSL Certificate** | `https://download.yourdomain.com` | Valid SSL padlock, issued by Let's Encrypt or Sectigo |
| **Landing Page UI** | Browser Inspection | Hero section, interactive tabs, and dark/light toggle work |
| **Interactive Terminal** | Click `status`, `vhost list`, `token create` | Simulated terminal responds with ANSI colors and outputs |
| **Checksum Copy** | Click `Copy Hash` | Toast notification displays "Copied to clipboard!" |
| **Binary Download** | Click `Download for Windows (.exe)` | Browser prompts save dialog for `cPanel-Localhost.exe` |
| **Modal Launch** | On download click | "Download Started!" guidance modal appears |

---

## Troubleshooting Common Issues

### 1. `403 Forbidden` Error
- **Cause:** Missing `index.html` in the document root, or directory permissions are incorrect.
- **Fix:** Ensure `index.html` is in `public_html/download/`. Ensure folder permissions are `0755` and file permissions are `0644`.

### 2. `500 Internal Server Error`
- **Cause:** Unsupported Apache directive in `.htaccess`.
- **Fix:** Open `.htaccess` in cPanel File Manager and verify that modules (`mod_rewrite`, `mod_headers`, `mod_deflate`) are wrapped in `<IfModule>` guards as provided in our configuration.

### 3. Executable File Fails to Download or Shows Error
- **Cause:** Host blocks direct `.exe` downloads or file exceeds upload limits.
- **Fix:**
  1. Verify `cPanel-Localhost.exe` is uploaded in `public_html/download/`.
  2. Confirm `.htaccess` has `AddType application/octet-stream .exe`.
  3. If your web host restricts `.exe` files, rename it or distribute `cPanel-Portable.zip`.

### 4. Cloudflare Error 526 (Invalid SSL Certificate)
- **Cause:** Cloudflare SSL mode is set to "Full (Strict)" before AutoSSL finishes installing on cPanel.
- **Fix:** In Cloudflare dashboard &gt; **SSL/TLS**, set mode to **Full** (not strict) temporarily, or set the DNS record to **DNS Only** (Grey Cloud) until AutoSSL completes.
