const mysql = require('mysql2/promise');
const config = require('../config');

let pool = null;

function createPool() {
  if (pool) {
    try {
      pool.end();
    } catch (e) {}
  }

  pool = mysql.createPool({
    host: config.xampp.mysql.host,
    port: config.xampp.mysql.port,
    user: config.xampp.mysql.user,
    password: config.xampp.mysql.password,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 3000,
    multipleStatements: true
  });

  return pool;
}

// Initial pool
pool = createPool();

const mysqlPool = {
  getPool() {
    if (!pool) {
      createPool();
    }
    return pool;
  },

  reconnect() {
    return createPool();
  },

  async isConnected() {
    try {
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
      return true;
    } catch (err) {
      return false;
    }
  },

  async query(sql, params = []) {
    try {
      const [results, fields] = await pool.query(sql, params);
      return { results, fields };
    } catch (err) {
      // If server was offline or connection lost, try reconnecting once
      if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
        try {
          createPool();
          const [results, fields] = await pool.query(sql, params);
          return { results, fields };
        } catch (retryErr) {
          throw retryErr;
        }
      }
      throw err;
    }
  },

  // Escape SQL identifier safely (e.g. database name or table name)
  escapeId(identifier) {
    return mysql.escapeId(identifier);
  }
};

module.exports = mysqlPool;
