const mysqlPool = require('../database/mysqlPool');
const panelDb = require('../database/panelDb');

// Valid identifier checker: alphanumeric + underscore, max 64 chars
function sanitizeIdentifier(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Database or username must be a non-empty string');
  }
  const clean = name.trim();
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(clean)) {
    throw new Error('Invalid name: only letters, numbers, and underscores are allowed (max 64 chars)');
  }
  return clean;
}

const ALLOWED_PRIVILEGES = [
  'ALL PRIVILEGES',
  'ALTER',
  'ALTER ROUTINE',
  'CREATE',
  'CREATE ROUTINE',
  'CREATE TEMPORARY TABLES',
  'CREATE VIEW',
  'DELETE',
  'DROP',
  'EVENT',
  'EXECUTE',
  'INDEX',
  'INSERT',
  'LOCK TABLES',
  'REFERENCES',
  'SELECT',
  'SHOW VIEW',
  'TRIGGER',
  'UPDATE'
];

const mysqlService = {
  // List all databases with size and table count
  async listDatabases() {
    // Check if connected
    const connected = await mysqlPool.isConnected();
    if (!connected) {
      return { connected: false, databases: [] };
    }

    // Get all databases
    const { results: dbRows } = await mysqlPool.query('SHOW DATABASES');
    const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys', 'phpmyadmin'];

    // Get table counts & size from information_schema
    const sizeQuery = `
      SELECT 
        table_schema AS dbName,
        COUNT(table_name) AS tableCount,
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS sizeMB
      FROM information_schema.tables
      GROUP BY table_schema;
    `;
    const { results: sizeRows } = await mysqlPool.query(sizeQuery);
    const sizeMap = {};
    for (const r of sizeRows) {
      sizeMap[r.dbName] = {
        tableCount: parseInt(r.tableCount || '0', 10),
        sizeMB: parseFloat(r.sizeMB || '0.00')
      };
    }

    // Get user permissions per database from mysql.db
    let dbUsersMap = {};
    try {
      const { results: dbUserRows } = await mysqlPool.query('SELECT Db, User FROM mysql.db');
      for (const row of dbUserRows) {
        if (!dbUsersMap[row.Db]) dbUsersMap[row.Db] = [];
        if (!dbUsersMap[row.Db].includes(row.User)) {
          dbUsersMap[row.Db].push(row.User);
        }
      }
    } catch (e) {
      // In some MySQL versions or privilege setups, mysql.db might require superuser
    }

    const databases = dbRows.map(row => {
      const name = row.Database;
      const stats = sizeMap[name] || { tableCount: 0, sizeMB: 0 };
      return {
        name,
        isSystem: systemDbs.includes(name.toLowerCase()),
        tableCount: stats.tableCount,
        sizeMB: stats.sizeMB,
        users: dbUsersMap[name] || []
      };
    });

    return { connected: true, databases };
  },

  // Create new database
  async createDatabase(dbName, collation = 'utf8mb4_unicode_ci') {
    const cleanName = sanitizeIdentifier(dbName);
    const validCollations = ['utf8mb4_unicode_ci', 'utf8mb4_general_ci', 'utf8_general_ci', 'latin1_swedish_ci'];
    const safeCollation = validCollations.includes(collation) ? collation : 'utf8mb4_unicode_ci';
    const charset = safeCollation.startsWith('utf8mb4') ? 'utf8mb4' : 'utf8';

    const sql = `CREATE DATABASE IF NOT EXISTS \`${cleanName}\` CHARACTER SET ${charset} COLLATE ${safeCollation}`;
    await mysqlPool.query(sql);

    return { success: true, dbName: cleanName };
  },

  // Drop database
  async dropDatabase(dbName) {
    const cleanName = sanitizeIdentifier(dbName);
    const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys', 'phpmyadmin'];
    if (systemDbs.includes(cleanName.toLowerCase())) {
      throw new Error(`Cannot delete MySQL system database "${cleanName}"`);
    }

    const sql = `DROP DATABASE IF EXISTS \`${cleanName}\``;
    await mysqlPool.query(sql);
    return { success: true, dbName: cleanName };
  },

  // Check Database
  async checkDatabase(dbName) {
    const cleanName = sanitizeIdentifier(dbName);
    const { results: tables } = await mysqlPool.query(`SHOW TABLES FROM \`${cleanName}\``);
    if (tables.length === 0) {
      return { dbName: cleanName, results: [{ Table: 'N/A', Op: 'check', Msg_type: 'status', Msg_text: 'Database has no tables.' }] };
    }

    const tableKey = Object.keys(tables[0])[0];
    const checkReports = [];

    for (const t of tables) {
      const tableName = t[tableKey];
      const { results: checkRes } = await mysqlPool.query(`CHECK TABLE \`${cleanName}\`.\`${tableName}\``);
      checkReports.push(...checkRes);
    }

    return { dbName: cleanName, results: checkReports };
  },

  // Repair Database
  async repairDatabase(dbName) {
    const cleanName = sanitizeIdentifier(dbName);
    const { results: tables } = await mysqlPool.query(`SHOW TABLES FROM \`${cleanName}\``);
    if (tables.length === 0) {
      return { dbName: cleanName, results: [{ Table: 'N/A', Op: 'repair', Msg_type: 'status', Msg_text: 'Database has no tables.' }] };
    }

    const tableKey = Object.keys(tables[0])[0];
    const repairReports = [];

    for (const t of tables) {
      const tableName = t[tableKey];
      const { results: repRes } = await mysqlPool.query(`REPAIR TABLE \`${cleanName}\`.\`${tableName}\``);
      repairReports.push(...repRes);
    }

    return { dbName: cleanName, results: repairReports };
  },

  // List MySQL Users
  async listUsers() {
    const connected = await mysqlPool.isConnected();
    if (!connected) return { connected: false, users: [] };

    try {
      const { results } = await mysqlPool.query("SELECT DISTINCT User, Host FROM mysql.user WHERE User != '' ORDER BY User ASC");
      const users = results.map(r => ({
        user: r.User,
        host: r.Host,
        isRoot: r.User.toLowerCase() === 'root'
      }));
      return { connected: true, users };
    } catch (err) {
      return { connected: false, error: err.message, users: [] };
    }
  },

  // Create MySQL User
  async createUser(username, password) {
    const cleanUser = sanitizeIdentifier(username);
    if (!password || password.length < 5) {
      throw new Error('Password must be at least 5 characters long');
    }

    // Create user if not exists, or update password if exists
    const sql = 'CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?';
    await mysqlPool.query(sql, [cleanUser, 'localhost', password]);
    await mysqlPool.query('ALTER USER ?@? IDENTIFIED BY ?', [cleanUser, 'localhost', password]);
    await mysqlPool.query('FLUSH PRIVILEGES');

    return { success: true, username: cleanUser, host: 'localhost' };
  },

  // Drop MySQL User
  async dropUser(username, host = 'localhost') {
    const cleanUser = sanitizeIdentifier(username);
    if (cleanUser.toLowerCase() === 'root') {
      throw new Error('Cannot delete MySQL root user!');
    }

    await mysqlPool.query('DROP USER IF EXISTS ?@?', [cleanUser, host]);
    await mysqlPool.query('FLUSH PRIVILEGES');

    return { success: true, username: cleanUser };
  },

  // Change User Password
  async changeUserPassword(username, newPassword, host = 'localhost') {
    const cleanUser = sanitizeIdentifier(username);
    if (!newPassword || newPassword.length < 5) {
      throw new Error('Password must be at least 5 characters');
    }

    await mysqlPool.query('ALTER USER ?@? IDENTIFIED BY ?', [cleanUser, host, newPassword]);
    await mysqlPool.query('FLUSH PRIVILEGES');

    return { success: true, username: cleanUser };
  },

  // Get User Privileges on Database
  async getUserPrivileges(username, dbName) {
    const cleanUser = sanitizeIdentifier(username);
    const cleanDb = sanitizeIdentifier(dbName);

    try {
      const { results } = await mysqlPool.query(
        'SELECT * FROM mysql.db WHERE User = ? AND (Db = ? OR Db = "%")',
        [cleanUser, cleanDb]
      );

      if (results.length === 0) {
        return { username: cleanUser, dbName: cleanDb, privileges: [] };
      }

      const row = results[0];
      const activePrivs = [];

      const privMap = {
        Select_priv: 'SELECT',
        Insert_priv: 'INSERT',
        Update_priv: 'UPDATE',
        Delete_priv: 'DELETE',
        Create_priv: 'CREATE',
        Drop_priv: 'DROP',
        Grant_priv: 'GRANT OPTION',
        References_priv: 'REFERENCES',
        Index_priv: 'INDEX',
        Alter_priv: 'ALTER',
        Create_tmp_table_priv: 'CREATE TEMPORARY TABLES',
        Lock_tables_priv: 'LOCK TABLES',
        Create_view_priv: 'CREATE VIEW',
        Show_view_priv: 'SHOW VIEW',
        Create_routine_priv: 'CREATE ROUTINE',
        Alter_routine_priv: 'ALTER ROUTINE',
        Execute_priv: 'EXECUTE',
        Event_priv: 'EVENT',
        Trigger_priv: 'TRIGGER'
      };

      for (const [col, priv] of Object.entries(privMap)) {
        if (row[col] === 'Y') {
          activePrivs.push(priv);
        }
      }

      return { username: cleanUser, dbName: cleanDb, privileges: activePrivs };
    } catch (e) {
      return { username: cleanUser, dbName: cleanDb, privileges: [] };
    }
  },

  // Set User Privileges on Database (cPanel style)
  async setUserPrivileges(username, dbName, privileges = []) {
    const cleanUser = sanitizeIdentifier(username);
    const cleanDb = sanitizeIdentifier(dbName);

    // Validate privileges
    const isAll = privileges.includes('ALL') || privileges.includes('ALL PRIVILEGES');
    let privList = '';

    if (isAll) {
      privList = 'ALL PRIVILEGES';
    } else {
      const validated = privileges.filter(p => ALLOWED_PRIVILEGES.includes(p.toUpperCase()));
      if (validated.length === 0) {
        // Revoke all
        await mysqlPool.query(`REVOKE ALL PRIVILEGES ON \`${cleanDb}\`.* FROM ?@?`, [cleanUser, 'localhost']);
        await mysqlPool.query('FLUSH PRIVILEGES');
        return { success: true, privileges: [] };
      }
      privList = validated.join(', ');
    }

    // Grant privileges
    const grantSql = `GRANT ${privList} ON \`${cleanDb}\`.* TO ?@?`;
    await mysqlPool.query(grantSql, [cleanUser, 'localhost']);
    await mysqlPool.query('FLUSH PRIVILEGES');

    return { success: true, username: cleanUser, dbName: cleanDb, granted: privList };
  },

  // Revoke User from Database
  async revokeUserFromDb(username, dbName) {
    const cleanUser = sanitizeIdentifier(username);
    const cleanDb = sanitizeIdentifier(dbName);

    try {
      await mysqlPool.query(`REVOKE ALL PRIVILEGES ON \`${cleanDb}\`.* FROM ?@?`, [cleanUser, 'localhost']);
      await mysqlPool.query('FLUSH PRIVILEGES');
    } catch (e) {}

    return { success: true };
  },

  // List Remote Access Hosts
  async listRemoteHosts() {
    const connected = await mysqlPool.isConnected();
    if (!connected) return { connected: false, hosts: [] };

    try {
      const { results } = await mysqlPool.query(
        "SELECT DISTINCT Host, User FROM mysql.user WHERE Host NOT IN ('localhost', '127.0.0.1', '::1') ORDER BY Host ASC"
      );
      
      const stored = panelDb.getRemoteHosts();
      const storedMap = {};
      for (const s of stored) {
        storedMap[s.host] = s;
      }

      const hostSet = new Set();
      const hosts = [];

      for (const r of results) {
        if (!hostSet.has(r.Host)) {
          hostSet.add(r.Host);
          const meta = storedMap[r.Host] || {};
          hosts.push({
            host: r.Host,
            user: r.User,
            comment: meta.comment || '',
            createdAt: meta.createdAt || null
          });
        }
      }

      for (const s of stored) {
        if (!hostSet.has(s.host)) {
          hostSet.add(s.host);
          hosts.push({
            host: s.host,
            user: 'root',
            comment: s.comment || '',
            createdAt: s.createdAt
          });
        }
      }

      return { connected: true, hosts };
    } catch (err) {
      return { connected: false, error: err.message, hosts: [] };
    }
  },

  // Add Remote Access Host
  async addRemoteHost(host, comment = '') {
    if (!host || typeof host !== 'string') {
      throw new Error('Valid host IP or wildcard mask is required (e.g. 192.168.1.% or %)');
    }
    const cleanHost = host.trim();
    if (!/^[%a-zA-Z0-9_.:-]+$/.test(cleanHost)) {
      throw new Error('Host contains invalid characters. Use valid IP, subnet wildcard (e.g. 192.168.1.%), or %');
    }

    try {
      await mysqlPool.query(`CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ''`, ['root', cleanHost]);
      await mysqlPool.query(`GRANT ALL PRIVILEGES ON *.* TO ?@? WITH GRANT OPTION`, ['root', cleanHost]);
      await mysqlPool.query('FLUSH PRIVILEGES');
    } catch (dbErr) {
      console.warn('[RemoteMySQL] DB grant warning:', dbErr.message);
    }

    const saved = panelDb.addRemoteHost(cleanHost, comment);
    return { success: true, host: cleanHost, comment, id: saved.id };
  },

  // Remove Remote Access Host
  async removeRemoteHost(host) {
    if (!host || typeof host !== 'string') {
      throw new Error('Host is required');
    }
    const cleanHost = host.trim();
    if (['localhost', '127.0.0.1', '::1'].includes(cleanHost)) {
      throw new Error('Cannot remove local access host');
    }

    try {
      await mysqlPool.query(`DROP USER IF EXISTS ?@?`, ['root', cleanHost]);
      await mysqlPool.query('FLUSH PRIVILEGES');
    } catch (e) {}

    panelDb.removeRemoteHost(cleanHost);
    return { success: true, host: cleanHost };
  }
};

module.exports = mysqlService;
