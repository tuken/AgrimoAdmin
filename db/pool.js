const mysql = require('mysql2/promise');

let _pool;

/**
 * Get or create a MySQL connection pool.
 * The pool is shared across the entire application lifecycle.
 */
function getPool() {
  if (_pool) return _pool;

  _pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    queueLimit: 0,
    charset: process.env.DB_CHARSET || 'utf8mb4'
  });

  return _pool;
}

/**
 * Execute a SQL query with parameters and return the resulting rows.
 * @param {string} sql - The SQL query to execute, with ? placeholders for parameters.
 * @param {Array} params - An array of parameters to substitute into the query.
 * @returns {Promise<Array>} - A promise that resolves to the array of result rows.
 */
async function query(sql, params = []) {
  const pool = getPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = { getPool, query };
