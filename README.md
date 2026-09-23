# cPanel-LocalHost 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL / MariaDB](https://img.shields.io/badge/MySQL-MariaDB-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Apache](https://img.shields.io/badge/Apache-HTTP_Server-D22128?logo=apache&logoColor=white)](https://httpd.apache.org/)
[![OpenAPI 3.0](https://img.shields.io/badge/OpenAPI-3.0.3-6BA539?logo=openapiinitiative&logoColor=white)](http://localhost:2083/api/ai/openapi.json)
[![UI Theme](https://img.shields.io/badge/UI_Theme-cPanel_Jupiter-FF6C2C)](https://cpanel.net)

> **Modern Web Hosting Control Panel for Localhost with Autonomous AI Integration & XAMPP / Apache / MySQL Orchestration.**

---

## 🌟 Overview

**cPanel-LocalHost** is a production-grade, browser-based web hosting control panel developed on a high-concurrency Node.js architecture. It replicates the authentic **cPanel Jupiter** interface while seamlessly orchestrating local web infrastructure (Apache HTTP Server, MariaDB/MySQL, and MultiPHP).

Beyond traditional hosting administration, **cPanel-LocalHost** features an **Autonomous AI Agent Integration Suite** — allowing AI models (such as **ChatGPT Custom GPT Actions, Anthropic Claude, Cursor, and LangChain**) to manage server files, databases, virtual hosts, and cron jobs programmatically through secure Bearer API tokens, OpenAPI 3.0 specifications, and authentic cPanel UAPI protocols.

---

## 💡 Key Features

### 📁 Advanced File Manager
- **Chroot Security Jail**: Traversal protection preventing directory escape attacks outside configured roots.
- **In-Browser Code Editor**: Syntax highlighting, line numbers, search, and direct file saving.
- **Archive Operations**: Native compression and extraction of `.zip` archives.
- **File System Operations**: Create, rename, delete, upload, download, and change file permissions.

### 🗄️ MySQL & MariaDB Orchestration
- **Connection Pooling**: High-throughput database transactions powered by `mysql2`.
- **Database & User Management**: Create/drop databases, add database users, and grant fine-grained SQL privileges.
- **phpMyAdmin Integration**: Single-click access and synchronization with local phpMyAdmin.

### 🌐 Domains & Virtual Hosts
- **Automated Apache Virtual Hosts**: Dynamic generation and modification of Apache `httpd-vhosts.conf`.
- **Custom Local Domains**: Easily bind custom domains (e.g. `mysite.local`, `app.test`) to document roots.
- **DNS Zone Editor**: Manage `A`, `CNAME`, `MX`, and `TXT` records for local virtual hosts.

### 🤖 Autonomous AI Agent Integration
- **Manage API Tokens**: Authenticated token system with SHA-256 hashing and granular permission scopes.
- **Universal AI Execution Gateway (`/api/ai/execute`)**: Single-entry function dispatcher tailored for LLM tool calling.
- **OpenAPI 3.0 Schemas (`/api/ai/openapi.json`)**: Plug-and-play compatibility with Custom GPT Actions, Cursor rules, and LangChain agents.
- **cPanel UAPI Compatibility**: Standardized JSON response envelope replicating production cPanel UAPI formats.

### ⏱️ Linux-Compatible Cron Schedulers
- **Standard 5-Field Cron Syntax**: Full support for standard Linux cron expressions (`* * * * *`).
- **Immediate Execution & History**: Execute jobs on demand and inspect execution logs.

### 🛡️ Security, SSL/TLS & MultiPHP
- **MultiPHP Version Selector**: Switch PHP runtime versions and edit `php.ini` directives.
- **SSL/TLS Management**: Self-signed and custom SSL certificate installation for local virtual hosts.
- **Security Protections**: Rate limiting, Helmet security headers, CSRF protection, and IP blocking.

### 📊 Real-Time Server Metrics & Diagnostics
- **Live System Telemetry**: CPU load, memory utilization, disk space, and active connections.
- **Network Tools**: Built-in ICMP Ping utility, traceroute, and DNS record lookups.
- **Custom Error Pages**: Manage HTTP error pages (`400`, `401`, `403`, `404`, `500`) synchronized with `.htaccess`.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph ClientLayer["Frontend Layer (Jupiter UI)"]
        UI["cPanel Jupiter Dashboard\n(HTML5 / CSS3 / Vanilla JS)"]
        FM["File Manager & Code Editor"]
        DB["Database & User Manager"]
        VH["Virtual Hosts & DNS Zone Editor"]
        AI_UI["API Tokens & AI Dashboard"]
    end

    subgraph ServerLayer["Backend API Server (Node.js & Express :2083)"]
        Router["Express API Router"]
        AuthMiddleware["Authentication & Bearer Token Validator"]
        CSRF["CSRF & Helmet Security Guard"]
        AIGateway["AI Universal Execution Gateway\n(/api/ai/execute & OpenAPI 3.0)"]
    end

    subgraph ServiceLayer["Local Service Orchestrator"]
        XAMPP["XAMPP / System Controller"]
        MySQLService["MySQL Connection Pool (mysql2)"]
        FileService["Chrooted File System Driver"]
        VHostService["Apache vhosts.conf Parser & Writer"]
        CronService["Cron Scheduler Engine"]
    end

    subgraph HostStack["Operating System & Services"]
        ApacheSrv["Apache HTTP Server (:80 / :443)"]
        MariaDBSrv["MariaDB / MySQL (:3306)"]
        PMA["phpMyAdmin"]
        Disk["Local File Storage & htdocs"]
        ExternalAI["Autonomous AI Agents\n(ChatGPT, Claude, Cursor)"]
    end

    UI --> Router
    FM --> Router
    DB --> Router
    VH --> Router
    AI_UI --> Router
    ExternalAI -->|Bearer API Token| AIGateway

    Router --> AuthMiddleware
    AuthMiddleware --> CSRF
    CSRF --> ServiceLayer

    AIGateway --> ServiceLayer
    XAMPP --> ApacheSrv
    MySQLService --> MariaDBSrv
    MySQLService --> PMA
    FileService --> Disk
    VHostService --> ApacheSrv
    CronService --> HostStack
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **Web Stack**: [XAMPP](https://www.apachefriends.org/) (Apache + MariaDB/MySQL) or standalone Apache & MySQL
- **Operating System**: Windows 10/11 (fully supported), Linux, or macOS

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/shubhXlab/cPanel-LocalHost.git
   cd cPanel-LocalHost
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment (Optional):**
   Copy `.env.example` or create a `.env` file:
   ```env
   PORT=2083
   HOST=localhost
   AUTO_START_SERVICES=true
   XAMPP_PATH=C:/xampp
   ```

4. **Start the Control Panel:**
   ```bash
   npm start
   ```

5. **Open Dashboard:**
   Visit `http://localhost:2083` in your web browser.

---

## 🤖 AI Agent Integration (ChatGPT / Claude / Cursor)

cPanel-LocalHost exposes a native AI Execution Gateway designed specifically for function-calling LLMs.

### 1. Generate an API Token
1. Open the cPanel dashboard at `http://localhost:2083`.
2. Navigate to **Security** &rarr; **Manage API Tokens**.
3. Create a new token with desired permissions (e.g. `files:read`, `files:write`, `mysql:manage`, `domains:manage`).
4. Copy the generated token (SHA-256 hashed on storage).

### 2. Connect to OpenAI Custom GPT / LangChain
- **OpenAPI Schema URL**: `http://localhost:2083/api/ai/openapi.json`
- **Authentication**: Bearer Token (`Authorization: Bearer <your-token>`)
- **Universal Dispatch Endpoint**: `POST /api/ai/execute`

#### Sample AI Dispatch Payload:
```json
POST /api/ai/execute
Headers:
  Authorization: Bearer YOUR_CPANEL_API_TOKEN
  Content-Type: application/json

Body:
{
  "module": "files",
  "action": "list",
  "params": {
    "dir": "/"
  }
}
```

---

## 📂 Project Structure

```text
cpanel-localhost/
├── client/                     # Frontend client (cPanel Jupiter UI)
│   ├── assets/                 # Icons, branding, SVG assets
│   ├── css/                    # Jupiter styles & component themes
│   ├── js/                     # Client controllers & API connectors
│   ├── index.html              # Main cPanel Dashboard
│   ├── files.html              # File Manager UI
│   ├── editor.html             # In-browser Code Editor
│   ├── databases.html          # MySQL & User Administration UI
│   ├── domains.html            # Virtual Hosts & Zone Editor UI
│   ├── advanced.html           # Cron Jobs & Error Pages UI
│   ├── security.html           # SSL/TLS & IP Blocker UI
│   ├── software.html           # MultiPHP & Package Management UI
│   └── api.html                # API Tokens & AI Gateway UI
├── server/                     # Backend application (Node.js & Express)
│   ├── config/                 # Service & environment configuration
│   ├── database/               # Database connection pools & schemas
│   ├── middleware/             # Auth, CSRF, security headers, rate-limiting
│   ├── routes/                 # Modular RESTful & UAPI endpoints
│   │   ├── advanced.js         # Cron, DNS & error routes
│   │   ├── apiTokens.js        # API token generator & AI execution gateway
│   │   ├── auth.js             # User authentication & session handlers
│   │   ├── backups.js          # Backup generation & restore routes
│   │   ├── domains.js          # Apache vhosts & DNS zone routes
│   │   ├── files.js            # Chrooted file manager endpoints
│   │   ├── metrics.js          # System metrics telemetry
│   │   ├── mysql.js            # MySQL/MariaDB orchestration
│   │   ├── security.js         # SSL/TLS & security routes
│   │   ├── software.js         # MultiPHP & PHP.ini management
│   │   └── xampp.js            # Service controller (Apache/MySQL)
│   ├── services/               # Core background automation engines
│   ├── app.js                  # Express application setup
│   └── server.js               # Entrypoint & port listener
├── docs/                       # Comprehensive documentation & reports
├── package.json                # Project dependencies and npm scripts
└── README.md                   # Project documentation
```

---

## 🧪 Testing

Run the automated integration and end-to-end verification test suite:

```bash
node test_cpanel_suite.js
```

---

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Shubham Ramjiyani** ([@shubhXlab](https://github.com/shubhXlab))

