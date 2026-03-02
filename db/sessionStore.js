const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

/**
 * Create an express-session store backed by MySQL.
 * We only persist sessions; no other application tables are touched.
 */
function createSessionStore() {
  const options = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    // Keep it explicit so it doesn't collide with upstream schemas.
    schema: {
      tableName: process.env.SESSION_TABLE || 'sessions',
      columnNames: {
        // DB schema uses `session_id` (not `sid`)
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    },

    // Housekeeping
    clearExpired: true,
    checkExpirationInterval: Number(process.env.SESSION_CHECK_EXPIRATION_MS || 15 * 60 * 1000),
    expiration: Number(process.env.SESSION_EXPIRATION_MS || 7 * 24 * 60 * 60 * 1000),

    // Optional tuning
    createDatabaseTable: process.env.SESSION_CREATE_TABLE === 'true',
    charset: process.env.DB_CHARSET || 'utf8mb4'
  };

  // If you want to manage DDL yourself, set SESSION_CREATE_TABLE=false
  return new MySQLStore(options);
}

module.exports = { createSessionStore };
