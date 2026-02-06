import pg from 'pg';
import config from '../config.js';

const { Pool } = pg;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'alfie',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT, 10) || 2000,
};

const pool = new Pool(dbConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

/**
 * Execute a query with optional parameters
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (process.env.DB_LOG_QUERIES === 'true') {
    console.log('Executed query', { text, duration, rows: result.rowCount });
  }
  
  return result;
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<pg.PoolClient>}
 */
export async function getClient() {
  return pool.connect();
}

/**
 * Execute a transaction with automatic commit/rollback
 * @param {Function} callback - Async function receiving client
 * @returns {Promise<any>}
 */
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Check database connection health
 * @returns {Promise<boolean>}
 */
export async function healthCheck() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    console.error('Database health check failed', err);
    return false;
  }
}

/**
 * Close all pool connections
 * @returns {Promise<void>}
 */
export async function close() {
  await pool.end();
}

export default {
  query,
  getClient,
  transaction,
  healthCheck,
  close,
  pool,
};
