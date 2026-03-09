import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const { Pool } = pg;

let pool;

function getDatabaseUrl() {
  return process.env.DATABASE_URL || '';
}

export async function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT, 10) || 2000,
    });
    pool.on('error', (err) => {
      console.error('Unexpected error on idle user service client', err);
    });
  }
  return pool;
}

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    roles: row.roles || ['user'],
    permissions: row.permissions || [],
    isActive: row.is_active,
    isVerified: row.is_verified,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
    metadata: row.metadata || {},
    oauth: row.oauth || null,
  };
}

function internalUser(row) {
  if (!row) return null;
  return {
    ...sanitizeUser(row),
    passwordHash: row.password_hash,
  };
}

/**
 * Initialize default admin user (no-op if exists)
 */
export async function initializeDefaultAdmin(defaultPassword) {
  const db = await getPool();
  const existing = await db.query('SELECT id FROM users WHERE email = $1', ['admin@alfie.local']);
  if (existing.rows.length > 0) return;

  const passwordHash = await bcrypt.hash(defaultPassword || 'Admin123!', 12);
  await db.query(
    `INSERT INTO users (email, username, password_hash, roles, permissions, is_active, is_verified)
     VALUES ($1, $2, $3, $4, $5, true, true)
     ON CONFLICT (email) DO NOTHING`,
    ['admin@alfie.local', 'admin', passwordHash, JSON.stringify(['admin']), JSON.stringify(['*'])]
  );
}

/**
 * Create a new user
 */
export async function createUser({ email, username, password, roles = ['user'], permissions = [], isVerified = false, oauth = null, metadata = {} }) {
  const db = await getPool();
  const normalizedEmail = email.toLowerCase().trim();

  let passwordHash = null;
  if (password) {
    passwordHash = await bcrypt.hash(password, 12);
  }

  try {
    const result = await db.query(
      `INSERT INTO users (email, username, password_hash, roles, permissions, is_verified, metadata, oauth)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [normalizedEmail, username.trim(), passwordHash, JSON.stringify(roles), JSON.stringify(permissions), isVerified, metadata, oauth]
    );
    return sanitizeUser(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      if (error.constraint === 'users_email_unique') {
        throw new Error('Email already registered');
      }
      if (error.constraint === 'users_username_unique') {
        throw new Error('Username already taken');
      }
    }
    throw error;
  }
}

/**
 * Find user by ID (sanitized — no password)
 */
export async function findById(id) {
  const db = await getPool();
  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return sanitizeUser(result.rows[0]);
}

/**
 * Find user by ID (internal — includes passwordHash)
 */
export async function findByIdInternal(id) {
  const db = await getPool();
  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return internalUser(result.rows[0]);
}

/**
 * Find user by email (sanitized)
 */
export async function findByEmail(email) {
  const db = await getPool();
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  return sanitizeUser(result.rows[0]);
}

/**
 * Find user by email (internal — includes passwordHash)
 */
export async function findByEmailInternal(email) {
  const db = await getPool();
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  return internalUser(result.rows[0]);
}

/**
 * Find user by OAuth provider
 */
export async function findByOAuth(provider, providerId) {
  const db = await getPool();
  const result = await db.query(
    `SELECT * FROM users WHERE oauth->>'provider' = $1 AND oauth->>'providerId' = $2`,
    [provider, providerId]
  );
  return sanitizeUser(result.rows[0]);
}

/**
 * Find user by OAuth provider (internal)
 */
export async function findByOAuthInternal(provider, providerId) {
  const db = await getPool();
  const result = await db.query(
    `SELECT * FROM users WHERE oauth->>'provider' = $1 AND oauth->>'providerId' = $2`,
    [provider, providerId]
  );
  return internalUser(result.rows[0]);
}

/**
 * Update user
 */
export async function updateUser(id, updates) {
  const db = await getPool();

  const setClauses = [];
  const values = [];
  let idx = 1;

  if (updates.email !== undefined) {
    setClauses.push(`email = $${idx}`);
    values.push(updates.email.toLowerCase().trim());
    idx++;
  }
  if (updates.username !== undefined) {
    setClauses.push(`username = $${idx}`);
    values.push(updates.username.trim());
    idx++;
  }
  if (updates.password !== undefined) {
    setClauses.push(`password_hash = $${idx}`);
    values.push(await bcrypt.hash(updates.password, 12));
    idx++;
  }
  if (updates.roles !== undefined) {
    setClauses.push(`roles = $${idx}`);
    values.push(JSON.stringify(updates.roles));
    idx++;
  }
  if (updates.permissions !== undefined) {
    setClauses.push(`permissions = $${idx}`);
    values.push(JSON.stringify(updates.permissions));
    idx++;
  }
  if (updates.isActive !== undefined) {
    setClauses.push(`is_active = $${idx}`);
    values.push(updates.isActive);
    idx++;
  }
  if (updates.isVerified !== undefined) {
    setClauses.push(`is_verified = $${idx}`);
    values.push(updates.isVerified);
    idx++;
  }
  if (updates.metadata !== undefined) {
    setClauses.push(`metadata = $${idx}`);
    values.push(updates.metadata);
    idx++;
  }
  if (updates.oauth !== undefined) {
    setClauses.push(`oauth = $${idx}`);
    values.push(updates.oauth);
    idx++;
  }

  if (setClauses.length === 0) {
    throw new Error('No valid updates provided');
  }

  values.push(id);

  try {
    const result = await db.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    return sanitizeUser(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      if (error.constraint === 'users_email_unique') {
        throw new Error('Email already registered');
      }
      if (error.constraint === 'users_username_unique') {
        throw new Error('Username already taken');
      }
    }
    throw error;
  }
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(id) {
  const db = await getPool();
  await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id]);
}

/**
 * Delete user
 */
export async function deleteUser(id) {
  const db = await getPool();
  const result = await db.query('DELETE FROM users WHERE id = $1', [id]);
  return result.rowCount > 0;
}

/**
 * Verify password against stored hash
 */
export async function verifyPassword(user, password) {
  if (!user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

/**
 * List users (paginated)
 */
export async function listUsers({ page = 1, limit = 20, includeInactive = false } = {}) {
  const db = await getPool();
  const offset = (page - 1) * limit;

  const whereClause = includeInactive ? '' : 'WHERE is_active = true';

  const countResult = await db.query(`SELECT COUNT(*) FROM users ${whereClause}`);
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await db.query(
    `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return {
    users: result.rows.map(sanitizeUser),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function storeRefreshToken(tokenId, userId, expiresAt, metadata = {}) {
  const db = await getPool();
  await db.query(
    `INSERT INTO refresh_tokens (token_id, user_id, expires_at, metadata)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (token_id) DO UPDATE SET expires_at = $3, metadata = $4`,
    [tokenId, userId, expiresAt, metadata]
  );
}

/**
 * Get refresh token data
 */
export async function getRefreshToken(tokenId) {
  const db = await getPool();
  const result = await db.query(
    `SELECT * FROM refresh_tokens WHERE token_id = $1 AND expires_at > NOW()`,
    [tokenId]
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return { userId: row.user_id, expiresAt: row.expires_at, metadata: row.metadata };
}

/**
 * Revoke refresh token
 */
export async function revokeRefreshToken(tokenId) {
  const db = await getPool();
  const result = await db.query('DELETE FROM refresh_tokens WHERE token_id = $1', [tokenId]);
  return result.rowCount > 0;
}

/**
 * Revoke all refresh tokens for user
 */
export async function revokeAllUserTokens(userId) {
  const db = await getPool();
  const result = await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
  return result.rowCount;
}

/**
 * Get user count
 */
export async function getUserCount() {
  const db = await getPool();
  const result = await db.query('SELECT COUNT(*) FROM users');
  return parseInt(result.rows[0].count, 10);
}

/**
 * Check if user has specific role
 */
export function hasRole(user, role) {
  return (user.roles || []).includes(role) || (user.roles || []).includes('admin');
}

/**
 * Check if user has specific permission
 */
export function hasPermission(user, permission) {
  if ((user.roles || []).includes('admin') || (user.permissions || []).includes('*')) {
    return true;
  }
  if ((user.permissions || []).includes(permission)) {
    return true;
  }
  const [resource] = permission.split(':');
  if ((user.permissions || []).includes(`${resource}:*`)) {
    return true;
  }
  return false;
}

export default {
  getPool,
  initializeDefaultAdmin,
  createUser,
  findById,
  findByIdInternal,
  findByEmail,
  findByEmailInternal,
  findByOAuth,
  findByOAuthInternal,
  updateUser,
  updateLastLogin,
  deleteUser,
  verifyPassword,
  listUsers,
  storeRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  getUserCount,
  hasRole,
  hasPermission,
};
