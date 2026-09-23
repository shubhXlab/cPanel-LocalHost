const express = require('express');
const router = express.Router();
const panelDb = require('../database/panelDb');

// Services
const fileService = require('../services/fileService');
const mysqlService = require('../services/mysqlService');
const domainService = require('../services/domainService');
const advancedService = require('../services/advancedService');
const securityService = require('../services/securityService');
const softwareService = require('../services/softwareService');
const backupService = require('../services/backupService');
const sysinfoService = require('../services/sysinfoService');
const terminalService = require('../services/terminalService');
const xamppService = require('../services/xamppService');

// Available scopes definition
const SCOPES_CONFIG = [
  { id: '*', name: 'Full Access (All Scopes)', description: 'Unrestricted administrative access to all cPanel modules and system capabilities.' },
  { id: 'files', name: 'File Manager', description: 'Read, write, create, delete, zip, and unzip files in public_html and document roots.' },
  { id: 'mysql', name: 'MySQL Databases', description: 'Create and drop databases, manage database users, and assign privileges.' },
  { id: 'domains', name: 'Domains & DNS', description: 'Manage primary domains, subdomains, redirects, and DNS Zone records.' },
  { id: 'advanced', name: 'Advanced & Cron', description: 'Schedule and execute cron jobs, manage custom HTTP error pages, and run network diagnostics.' },
  { id: 'security', name: 'Security & SSL', description: 'Generate and inspect SSL/TLS certificates, manage IP firewall bans, and configure 2FA.' },
  { id: 'software', name: 'Software & PHP', description: 'Manage PHP version, edit php.ini directives, and toggle PHP extensions.' },
  { id: 'metrics', name: 'Metrics & Logs', description: 'Inspect visitor logs, web traffic, resource consumption, and Apache error logs.' },
  { id: 'backups', name: 'Backups', description: 'Generate, download, and restore system, database, and public_html archive backups.' },
  { id: 'system', name: 'System & Services', description: 'Check server health, hardware resource usage, and control Apache / MySQL services.' },
  { id: 'terminal', name: 'Terminal / SSH', description: 'Execute shell commands on the server environment (requires administrative token).' }
];

// ============================================================================
// 1. API Token Management Endpoints
// ============================================================================

// List all API tokens for the authenticated user
router.get('/tokens', (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const tokens = panelDb.getApiTokens(userId);
    res.json({ success: true, tokens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new API token
router.post('/tokens', (req, res) => {
  try {
    const { name, scopes, expiresAt } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Token name is required' });
    }

    const userId = req.user ? req.user.id : 'usr_admin';
    const result = panelDb.createApiToken({
      name: name.trim(),
      scopes: scopes && Array.isArray(scopes) && scopes.length > 0 ? scopes : ['*'],
      expiresAt: expiresAt || null,
      userId: userId
    });

    panelDb.logAction('CREATE_API_TOKEN', `Created token "${result.token.name}"`, userId, req.ip);
    res.status(201).json({
      success: true,
      message: 'API Token generated successfully. Please copy it now, it will not be displayed again.',
      token: result.token,
      rawToken: result.rawToken
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete / Revoke an API token
router.delete('/tokens/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;
    const deleted = panelDb.deleteApiToken(id, userId);

    if (!deleted) {
      return res.status(404).json({ error: 'API token not found or already revoked' });
    }

    panelDb.logAction('REVOKE_API_TOKEN', `Revoked token ID ${id}`, userId, req.ip);
    res.json({ success: true, message: 'API token revoked successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List available scopes
router.get('/tokens/scopes', (req, res) => {
  res.json({ success: true, scopes: SCOPES_CONFIG });
});

// ============================================================================
// 2. AI Discovery & Integration Specs (OpenAPI 3.0, OpenAI Tools, Claude Tools)
// ============================================================================

// OpenAPI 3.0.3 Specification
router.get('/ai/openapi.json', (req, res) => {
  const host = req.get('host') || 'localhost:2083';
  const protocol = req.protocol || 'http';
  const baseUrl = `${protocol}://${host}`;

  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'Localhost cPanel Management API',
      description: 'Native REST and AI Function-Calling API for controlling local cPanel hosting services, files, MySQL databases, Apache vhosts, DNS, cron jobs, backups, metrics, and software.',
      version: '2.0.8',
      contact: { name: 'cPanel Localhost Administrator' }
    },
    servers: [
      { url: baseUrl, description: 'Localhost cPanel Server' }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Token',
          description: 'Pass API Token generated in cPanel Manage API Tokens: `Authorization: Bearer cptok_...`'
        },
        CPanelAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
          description: 'Authentic cPanel header: `Authorization: cpanel admin:cptok_...`'
        }
      }
    },
    security: [{ BearerAuth: [] }, { CPanelAuth: [] }],
    paths: {
      '/api/files': {
        get: {
          summary: 'List directory contents',
          description: 'List files and folders in the specified relative path (default: /)',
          parameters: [{ name: 'dir', in: 'query', schema: { type: 'string', default: '/' }, description: 'Relative path inside web root (e.g. /public_html)' }],
          responses: { 200: { description: 'Directory items list' } }
        }
      },
      '/api/files/content': {
        get: {
          summary: 'Read file contents',
          parameters: [{ name: 'path', in: 'query', required: true, schema: { type: 'string' }, description: 'Relative file path (e.g. public_html/index.php)' }],
          responses: { 200: { description: 'File content' } }
        }
      },
      '/api/files/save': {
        post: {
          summary: 'Write / Save file contents',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } }
          },
          responses: { 200: { description: 'File saved' } }
        }
      },
      '/api/mysql/databases': {
        get: { summary: 'List all MySQL databases', responses: { 200: { description: 'Database list' } } },
        post: {
          summary: 'Create a new MySQL database',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } } },
          responses: { 200: { description: 'Database created' } }
        }
      },
      '/api/mysql/databases/{name}': {
        delete: {
          summary: 'Drop a MySQL database',
          parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Database dropped' } }
        }
      },
      '/api/domains': {
        get: { summary: 'List all configured domains', responses: { 200: { description: 'Domain list' } } },
        post: {
          summary: 'Add a new domain or subdomain',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { domain: { type: 'string' }, documentRoot: { type: 'string' }, type: { type: 'string', enum: ['addon', 'subdomain', 'primary'] } }, required: ['domain'] } } } },
          responses: { 200: { description: 'Domain added' } }
        }
      },
      '/api/advanced/cron': {
        get: { summary: 'List all cron jobs', responses: { 200: { description: 'Cron jobs list' } } },
        post: {
          summary: 'Add a new cron job',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { schedule: { type: 'string', example: '0 0 * * *' }, command: { type: 'string' }, description: { type: 'string' } }, required: ['schedule', 'command'] } } } },
          responses: { 200: { description: 'Cron job created' } }
        }
      },
      '/api/advanced/cron/{id}/run': {
        post: {
          summary: 'Run a cron job immediately',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Execution result' } }
        }
      },
      '/api/security/ssl/status': {
        get: { summary: 'Get SSL/TLS certificate status for all domains', responses: { 200: { description: 'SSL certificates' } } }
      },
      '/api/metrics/summary': {
        get: { summary: 'Get live system resources and visitor metrics', responses: { 200: { description: 'Server metrics' } } }
      },
      '/api/backups': {
        get: { summary: 'List all available backups', responses: { 200: { description: 'Backups list' } } },
        post: {
          summary: 'Create a backup',
          requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { type: { type: 'string', enum: ['full', 'homedir', 'mysql'] } } } } } },
          responses: { 200: { description: 'Backup generated' } }
        }
      },
      '/api/ai/execute': {
        post: {
          summary: 'Universal AI Action Gateway',
          description: 'Single endpoint allowing AI models to execute any cPanel tool or action by name.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tool: { type: 'string', description: 'Name of the cPanel tool to run' },
                    parameters: { type: 'object', description: 'Parameters for the tool' }
                  },
                  required: ['tool']
                }
              }
            }
          },
          responses: { 200: { description: 'Execution output' } }
        }
      }
    }
  };

  res.json(spec);
});

// Tool Definitions for OpenAI Function Calling & Anthropic Claude Tools
router.get('/ai/tools', (req, res) => {
  const tools = [
    // Files
    {
      name: 'file_list',
      description: 'List files and directories inside a relative path (e.g. public_html)',
      parameters: {
        type: 'object',
        properties: {
          dir: { type: 'string', description: 'Directory path relative to web root (e.g. / or public_html)', default: '/' }
        }
      }
    },
    {
      name: 'file_read',
      description: 'Read the text content of a file in the web root or public_html',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to file (e.g. public_html/index.php)' }
        },
        required: ['path']
      }
    },
    {
      name: 'file_write',
      description: 'Write, create, or update the contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to file (e.g. public_html/config.php)' },
          content: { type: 'string', description: 'Complete content to write into the file' }
        },
        required: ['path', 'content']
      }
    },
    {
      name: 'file_create',
      description: 'Create a new empty file or folder',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to create' },
          type: { type: 'string', enum: ['file', 'dir'], default: 'file' }
        },
        required: ['path']
      }
    },
    {
      name: 'file_delete',
      description: 'Delete a file or folder recursively',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to delete' }
        },
        required: ['path']
      }
    },
    // MySQL
    {
      name: 'mysql_list_databases',
      description: 'List all MySQL / MariaDB databases along with table counts and size',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'mysql_create_database',
      description: 'Create a new MySQL database',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the database to create (alphanumeric and underscores)' }
        },
        required: ['name']
      }
    },
    {
      name: 'mysql_delete_database',
      description: 'Drop / Delete a MySQL database',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the database to drop' }
        },
        required: ['name']
      }
    },
    {
      name: 'mysql_list_users',
      description: 'List all MySQL user accounts',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'mysql_create_user',
      description: 'Create a new MySQL user account',
      parameters: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'Username to create' },
          password: { type: 'string', description: 'Password for user' }
        },
        required: ['username', 'password']
      }
    },
    {
      name: 'mysql_set_privileges',
      description: 'Grant database privileges to a MySQL user on a specific database',
      parameters: {
        type: 'object',
        properties: {
          db: { type: 'string', description: 'Database name' },
          user: { type: 'string', description: 'Username' },
          privileges: { type: 'array', items: { type: 'string' }, description: 'Array of privileges, e.g. ["ALL PRIVILEGES"]' }
        },
        required: ['db', 'user']
      }
    },
    // Domains & DNS
    {
      name: 'domain_list',
      description: 'List all domains, addon domains, and subdomains configured in cPanel',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'domain_create',
      description: 'Add a new domain, addon domain, or subdomain with automatic Apache vhosts and DNS records',
      parameters: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Domain name (e.g. test.local or app.localhost)' },
          documentRoot: { type: 'string', description: 'Document root path (optional)' },
          type: { type: 'string', enum: ['addon', 'subdomain', 'primary'], default: 'addon' }
        },
        required: ['domain']
      }
    },
    {
      name: 'dns_list_records',
      description: 'List DNS zone records (A, CNAME, MX, TXT)',
      parameters: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Optional domain filter' }
        }
      }
    },
    {
      name: 'dns_create_record',
      description: 'Create a new DNS zone record',
      parameters: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Parent domain' },
          name: { type: 'string', description: 'Record name (e.g. sub.domain.com.)' },
          type: { type: 'string', enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT'], default: 'A' },
          record: { type: 'string', description: 'Destination IP, CNAME host, or text' },
          ttl: { type: 'integer', default: 14400 }
        },
        required: ['domain', 'name', 'type', 'record']
      }
    },
    // Cron Jobs
    {
      name: 'cron_list',
      description: 'List all automated cron jobs',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'cron_create',
      description: 'Create a new scheduled cron job',
      parameters: {
        type: 'object',
        properties: {
          schedule: { type: 'string', description: '5-part cron syntax (e.g. */15 * * * * or 0 0 * * *)' },
          command: { type: 'string', description: 'CLI command or PHP script to execute' },
          description: { type: 'string', description: 'Human-readable description of the cron job' }
        },
        required: ['schedule', 'command']
      }
    },
    {
      name: 'cron_run_now',
      description: 'Execute a cron job immediately and capture stdout, stderr, and execution duration',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Cron job ID' }
        },
        required: ['id']
      }
    },
    // Security & SSL
    {
      name: 'ssl_list_certificates',
      description: 'List installed SSL/TLS certificates and expiration statuses',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'ssl_generate_self_signed',
      description: 'Generate a self-signed SSL/TLS certificate for a domain',
      parameters: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Domain name' }
        },
        required: ['domain']
      }
    },
    {
      name: 'ip_blocker_list',
      description: 'List IP addresses currently blocked in Apache .htaccess',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'ip_blocker_add',
      description: 'Block an IP address or CIDR subnet from accessing the server',
      parameters: {
        type: 'object',
        properties: {
          ip: { type: 'string', description: 'IP address or CIDR' },
          reason: { type: 'string', description: 'Optional reason for blocking' }
        },
        required: ['ip']
      }
    },
    // Software & PHP
    {
      name: 'software_php_info',
      description: 'Get current PHP version and configuration details',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'software_php_directives',
      description: 'Get key php.ini directives (memory_limit, upload_max_filesize, etc.)',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'software_php_update_directives',
      description: 'Update directives inside the active php.ini file',
      parameters: {
        type: 'object',
        properties: {
          directives: { type: 'object', description: 'Key-value map of directives, e.g. { "memory_limit": "512M" }' }
        },
        required: ['directives']
      }
    },
    // Backups
    {
      name: 'backup_list',
      description: 'List all available backup archives',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'backup_create',
      description: 'Generate a new backup archive (full, homedir, or mysql)',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['full', 'homedir', 'mysql'], default: 'full' }
        }
      }
    },
    // System & Metrics
    {
      name: 'system_status',
      description: 'Get live status of Apache and MySQL services, ports, and uptime',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'system_resources',
      description: 'Get CPU usage, RAM breakdown, disk space, and OS information',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'metrics_summary',
      description: 'Get live visitor statistics, bandwidth, and traffic metrics',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'terminal_execute',
      description: 'Execute a shell command in the server environment (requires terminal scope)',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command line to execute' }
        },
        required: ['command']
      }
    }
  ];

  // OpenAI format
  const openaiTools = tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }));

  // Claude format
  const claudeTools = tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters
  }));

  // Single Universal Gateway Tool
  const singleGatewayTool = {
    type: 'function',
    function: {
      name: 'cpanel_action',
      description: 'Execute any administrative action on the localhost cPanel server (files, databases, domains, cron jobs, backups, ssl, metrics, etc.).',
      parameters: {
        type: 'object',
        properties: {
          tool: {
            type: 'string',
            description: 'Name of the cPanel tool to run',
            enum: tools.map(t => t.name)
          },
          parameters: {
            type: 'object',
            description: 'Key-value map of parameters corresponding to the chosen tool'
          }
        },
        required: ['tool']
      }
    }
  };

  res.json({
    success: true,
    count: tools.length,
    openai: openaiTools,
    claude: claudeTools,
    single_gateway_tool: singleGatewayTool
  });
});

// Prompt generator for AI agents
router.get('/ai/prompt', (req, res) => {
  const host = req.get('host') || 'localhost:2083';
  const protocol = req.protocol || 'http';
  const baseUrl = `${protocol}://${host}`;

  const prompt = `You are connected to a real cPanel web hosting server via its REST & AI API.
Base URL: ${baseUrl}
Authentication Header: Authorization: Bearer <YOUR_API_TOKEN> (or Authorization: cpanel admin:<YOUR_API_TOKEN>)

You have complete capability to manage the hosting environment, including:
1. Files: read/write/create/delete/zip in public_html and document roots.
2. Databases: MySQL database creation, user permissions, and queries.
3. Domains: Adding domains, configuring virtual hosts, and editing DNS records.
4. Cron Jobs: Creating scheduled background tasks and triggering them on demand.
5. SSL/TLS: Viewing certificates and generating self-signed SSL.
6. Software: Configuring PHP versions, php.ini directives, and extensions.
7. Backups: Creating full, homedir, or database backups.
8. Metrics: Checking visitor statistics, access logs, and server resource usage.

To execute actions, you can either:
- Send HTTP POST requests to "${baseUrl}/api/ai/execute" with JSON: { "tool": "<tool_name>", "parameters": { ... } }
- Or call the direct REST endpoints documented in "${baseUrl}/api/ai/openapi.json".
- Or use authentic cPanel UAPI endpoints: "${baseUrl}/api/uapi/<Module>/<function>".

Always verify operations and return clear, concise status updates to the user.`;

  res.json({
    success: true,
    baseUrl: baseUrl,
    system_prompt: prompt
  });
});

// ============================================================================
// 3. Universal AI Execution Gateway (Single Tool Router)
// ============================================================================

router.post('/ai/execute', async (req, res) => {
  const { tool, parameters = {} } = req.body;

  if (!tool || typeof tool !== 'string') {
    return res.status(400).json({ success: false, error: 'Parameter "tool" is required' });
  }

  const scopes = (req.apiToken && req.apiToken.scopes) ? req.apiToken.scopes : ['*'];
  const hasScope = (s) => scopes.includes('*') || scopes.includes(s);

  try {
    let result = null;

    switch (tool) {
      // --- File Manager ---
      case 'file_list':
        if (!hasScope('files')) throw new Error('API token lacks "files" scope');
        result = await fileService.list(parameters.dir || '/');
        break;

      case 'file_read':
        if (!hasScope('files')) throw new Error('API token lacks "files" scope');
        if (!parameters.path) throw new Error('Parameter "path" is required');
        result = await fileService.readFile(parameters.path);
        break;

      case 'file_write':
        if (!hasScope('files')) throw new Error('API token lacks "files" scope');
        if (!parameters.path) throw new Error('Parameter "path" is required');
        result = await fileService.saveFile(parameters.path, parameters.content || '');
        break;

      case 'file_create':
        if (!hasScope('files')) throw new Error('API token lacks "files" scope');
        if (!parameters.path) throw new Error('Parameter "path" is required');
        result = await fileService.create(parameters.path, parameters.type || 'file');
        break;

      case 'file_delete':
        if (!hasScope('files')) throw new Error('API token lacks "files" scope');
        if (!parameters.path) throw new Error('Parameter "path" is required');
        result = await fileService.delete(parameters.path);
        break;

      case 'file_rename':
        if (!hasScope('files')) throw new Error('API token lacks "files" scope');
        if (!parameters.oldPath || !parameters.newPath) throw new Error('oldPath and newPath are required');
        result = await fileService.rename(parameters.oldPath, parameters.newPath);
        break;

      case 'file_extract':
        if (!hasScope('files')) throw new Error('API token lacks "files" scope');
        if (!parameters.zipPath) throw new Error('Parameter "zipPath" is required');
        result = await fileService.extract(parameters.zipPath, parameters.targetDir || '');
        break;

      case 'file_compress':
        if (!hasScope('files')) throw new Error('API token lacks "files" scope');
        if (!parameters.paths || !parameters.targetZip) throw new Error('paths array and targetZip are required');
        result = await fileService.compress(parameters.paths, parameters.targetZip);
        break;

      // --- MySQL Databases ---
      case 'mysql_list_databases':
        if (!hasScope('mysql')) throw new Error('API token lacks "mysql" scope');
        result = await mysqlService.listDatabases();
        break;

      case 'mysql_create_database':
        if (!hasScope('mysql')) throw new Error('API token lacks "mysql" scope');
        if (!parameters.name) throw new Error('Parameter "name" is required');
        result = await mysqlService.createDatabase(parameters.name);
        break;

      case 'mysql_delete_database':
        if (!hasScope('mysql')) throw new Error('API token lacks "mysql" scope');
        if (!parameters.name) throw new Error('Parameter "name" is required');
        result = await mysqlService.dropDatabase(parameters.name);
        break;

      case 'mysql_list_users':
        if (!hasScope('mysql')) throw new Error('API token lacks "mysql" scope');
        result = await mysqlService.listUsers();
        break;

      case 'mysql_create_user':
        if (!hasScope('mysql')) throw new Error('API token lacks "mysql" scope');
        if (!parameters.username || !parameters.password) throw new Error('username and password are required');
        result = await mysqlService.createUser(parameters.username, parameters.password);
        break;

      case 'mysql_set_privileges':
        if (!hasScope('mysql')) throw new Error('API token lacks "mysql" scope');
        if (!parameters.db || !parameters.user) throw new Error('db and user are required');
        result = await mysqlService.setPrivileges(parameters.db, parameters.user, parameters.privileges || ['ALL PRIVILEGES']);
        break;

      // --- Domains & DNS ---
      case 'domain_list':
        if (!hasScope('domains')) throw new Error('API token lacks "domains" scope');
        result = domainService.getDomains();
        break;

      case 'domain_create':
        if (!hasScope('domains')) throw new Error('API token lacks "domains" scope');
        if (!parameters.domain) throw new Error('Parameter "domain" is required');
        result = await domainService.addDomain(parameters);
        break;

      case 'domain_delete':
        if (!hasScope('domains')) throw new Error('API token lacks "domains" scope');
        if (!parameters.id) throw new Error('Parameter "id" is required');
        result = await domainService.removeDomain(parameters.id);
        break;

      case 'dns_list_records':
        if (!hasScope('domains')) throw new Error('API token lacks "domains" scope');
        result = panelDb.getZoneRecords(parameters.domain);
        break;

      case 'dns_create_record':
        if (!hasScope('domains')) throw new Error('API token lacks "domains" scope');
        result = panelDb.addZoneRecord(parameters);
        break;

      case 'dns_delete_record':
        if (!hasScope('domains')) throw new Error('API token lacks "domains" scope');
        if (!parameters.id) throw new Error('Parameter "id" is required');
        result = panelDb.deleteZoneRecord(parameters.id);
        break;

      // --- Cron Jobs ---
      case 'cron_list':
        if (!hasScope('advanced')) throw new Error('API token lacks "advanced" scope');
        result = advancedService.getCronJobs();
        break;

      case 'cron_create':
        if (!hasScope('advanced')) throw new Error('API token lacks "advanced" scope');
        result = advancedService.addCronJob(parameters);
        break;

      case 'cron_delete':
        if (!hasScope('advanced')) throw new Error('API token lacks "advanced" scope');
        if (!parameters.id) throw new Error('Parameter "id" is required');
        result = advancedService.deleteCronJob(parameters.id);
        break;

      case 'cron_run_now':
        if (!hasScope('advanced')) throw new Error('API token lacks "advanced" scope');
        if (!parameters.id) throw new Error('Parameter "id" is required');
        result = await advancedService.runCronJobNow(parameters.id);
        break;

      // --- Security & SSL ---
      case 'ssl_list_certificates':
        if (!hasScope('security')) throw new Error('API token lacks "security" scope');
        result = await securityService.getSslStatus();
        break;

      case 'ssl_generate_self_signed':
        if (!hasScope('security')) throw new Error('API token lacks "security" scope');
        if (!parameters.domain) throw new Error('Parameter "domain" is required');
        result = await securityService.generateSelfSignedCert(parameters.domain);
        break;

      case 'ip_blocker_list':
        if (!hasScope('security')) throw new Error('API token lacks "security" scope');
        result = securityService.getBlockedIps();
        break;

      case 'ip_blocker_add':
        if (!hasScope('security')) throw new Error('API token lacks "security" scope');
        if (!parameters.ip) throw new Error('Parameter "ip" is required');
        result = await securityService.blockIp(parameters.ip, parameters.reason || 'Blocked via AI API');
        break;

      // --- Software & PHP ---
      case 'software_php_info':
        if (!hasScope('software')) throw new Error('API token lacks "software" scope');
        result = softwareService.getMultiPhpInfo();
        break;

      case 'software_php_directives':
        if (!hasScope('software')) throw new Error('API token lacks "software" scope');
        result = softwareService.getPhpIniDirectives();
        break;

      case 'software_php_update_directives':
        if (!hasScope('software')) throw new Error('API token lacks "software" scope');
        if (!parameters.directives) throw new Error('Parameter "directives" is required');
        result = softwareService.savePhpIniDirectives(parameters.directives);
        break;

      // --- Backups ---
      case 'backup_list':
        if (!hasScope('backups')) throw new Error('API token lacks "backups" scope');
        result = backupService.listBackups();
        break;

      case 'backup_create':
        if (!hasScope('backups')) throw new Error('API token lacks "backups" scope');
        result = await backupService.createBackup(parameters.type || 'full');
        break;

      // --- System & Metrics ---
      case 'system_status':
        if (!hasScope('system')) throw new Error('API token lacks "system" scope');
        result = await xamppService.getStatus();
        break;

      case 'system_resources':
        if (!hasScope('system')) throw new Error('API token lacks "system" scope');
        result = await sysinfoService.getServerInfo();
        break;

      case 'metrics_summary':
        if (!hasScope('metrics')) throw new Error('API token lacks "metrics" scope');
        result = await sysinfoService.getStats();
        break;

      case 'terminal_execute':
        if (!hasScope('terminal')) throw new Error('API token lacks "terminal" scope');
        if (!parameters.command) throw new Error('Parameter "command" is required');
        result = await terminalService.runCommand(parameters.command);
        break;

      default:
        return res.status(400).json({ success: false, error: `Unknown tool: "${tool}". Request GET /api/ai/tools for available tools.` });
    }

    res.json({
      success: true,
      tool: tool,
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      tool: tool,
      error: err.message
    });
  }
});

// ============================================================================
// 4. Authentic cPanel UAPI Compatibility Gateway
// ============================================================================

router.all('/uapi/:module/:func', async (req, res) => {
  const { module, func } = req.params;
  const args = Object.assign({}, req.query, req.body);

  const modKey = module.toLowerCase();
  const funcKey = func.toLowerCase();

  try {
    let result = null;

    if (modKey === 'fileman') {
      if (funcKey === 'list_files') result = await fileService.list(args.dir || '/');
      else if (funcKey === 'get_file_content') result = await fileService.readFile(args.path || args.file);
      else if (funcKey === 'save_file') result = await fileService.saveFile(args.path || args.file, args.content || '');
      else if (funcKey === 'create_file') result = await fileService.create(args.path || args.file, args.type || 'file');
      else throw new Error(`Unknown Fileman UAPI function: ${func}`);
    } else if (modKey === 'mysql') {
      if (funcKey === 'create_database') result = await mysqlService.createDatabase(args.name);
      else if (funcKey === 'delete_database') result = await mysqlService.dropDatabase(args.name);
      else if (funcKey === 'list_databases') result = await mysqlService.listDatabases();
      else if (funcKey === 'list_users') result = await mysqlService.listUsers();
      else throw new Error(`Unknown Mysql UAPI function: ${func}`);
    } else if (modKey === 'domaininfo') {
      if (funcKey === 'list_domains') result = domainService.getDomains();
      else throw new Error(`Unknown DomainInfo UAPI function: ${func}`);
    } else if (modKey === 'cron') {
      if (funcKey === 'list_cron') result = advancedService.getCronJobs();
      else if (funcKey === 'add_line') result = advancedService.addCronJob(args);
      else throw new Error(`Unknown Cron UAPI function: ${func}`);
    } else if (modKey === 'ssl') {
      if (funcKey === 'installed_hosts') result = await securityService.getSslStatus();
      else throw new Error(`Unknown SSL UAPI function: ${func}`);
    } else if (modKey === 'xampp' || modKey === 'system') {
      if (funcKey === 'status') result = await xamppService.getStatus();
      else throw new Error(`Unknown System UAPI function: ${func}`);
    } else {
      throw new Error(`UAPI Module not implemented: ${module}`);
    }

    res.json({
      status: 1,
      module: module,
      function: func,
      data: result,
      errors: null,
      messages: null,
      metadata: {}
    });
  } catch (err) {
    res.status(500).json({
      status: 0,
      module: module,
      function: func,
      data: null,
      errors: [err.message],
      messages: null,
      metadata: {}
    });
  }
});

module.exports = router;
