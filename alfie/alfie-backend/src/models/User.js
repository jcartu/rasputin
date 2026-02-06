import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * User model with in-memory storage
 * Production: Replace with database (PostgreSQL, MongoDB, etc.)
 */

// In-memory user storage
const users = new Map();
const usersByEmail = new Map();
const refreshTokens = new Map();

// Default admin user (created on first startup)
const DEFAULT_ADMIN = {
  id: 'admin-001',
  email: 'admin@alfie.local',
  username: 'admin',
  passwordHash: null, // Set from env or default
  roles: ['admin'],
  permissions: ['*'],
  isActive: true,
  isVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLoginAt: null,
  metadata: {
    createdBy: 'system',
    source: 'default'
  }
};

/**
 * User schema structure
 * @typedef {Object} User
 * @property {string} id - Unique user ID
 * @property {string} email - User email (unique)
 * @property {string} username - Username (unique)
 * @property {string} passwordHash - Bcrypt hashed password
 * @property {string[]} roles - Array of role names
 * @property {string[]} permissions - Direct permission grants
 * @property {boolean} isActive - Account active status
 * @property {boolean} isVerified - Email verification status
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 * @property {string|null} lastLoginAt - Last login timestamp
 * @property {Object} metadata - Additional user metadata
 * @property {Object|null} oauth - OAuth provider data
 */

/**
 * Initialize default admin user
 */
export async function initializeDefaultAdmin(defaultPassword) {
  if (!users.has(DEFAULT_ADMIN.id)) {
    const passwordHash = await bcrypt.hash(defaultPassword || 'admin123!', 12);
    const admin = { ...DEFAULT_ADMIN, passwordHash };
    users.set(admin.id, admin);
    usersByEmail.set(admin.email.toLowerCase(), admin.id);
    console.log('Default admin user initialized');
  }
}

/**
 * Generate unique user ID
 */
function generateUserId() {
  return `usr_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Create a new user
 */
export async function createUser({
  email,
  username,
  password,
  roles = ['user'],
  permissions = [],
  isVerified = false,
  oauth = null,
  metadata = {}
}) {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check for existing email
  if (usersByEmail.has(normalizedEmail)) {
    throw new Error('Email already registered');
  }
  
  // Check for existing username
  for (const user of users.values()) {
    if (user.username.toLowerCase() === username.toLowerCase()) {
      throw new Error('Username already taken');
    }
  }
  
  const id = generateUserId();
  const now = new Date().toISOString();
  
  // Hash password if provided (OAuth users may not have password)
  let passwordHash = null;
  if (password) {
    passwordHash = await bcrypt.hash(password, 12);
  }
  
  const user = {
    id,
    email: normalizedEmail,
    username: username.trim(),
    passwordHash,
    roles,
    permissions,
    isActive: true,
    isVerified,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    metadata: {
      ...metadata,
      registrationIp: metadata.registrationIp || null,
      userAgent: metadata.userAgent || null
    },
    oauth
  };
  
  users.set(id, user);
  usersByEmail.set(normalizedEmail, id);
  
  return sanitizeUser(user);
}

/**
 * Find user by ID
 */
export function findById(id) {
  const user = users.get(id);
  return user ? sanitizeUser(user) : null;
}

/**
 * Find user by ID (including sensitive data - internal use only)
 */
export function findByIdInternal(id) {
  return users.get(id) || null;
}

/**
 * Find user by email
 */
export function findByEmail(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const userId = usersByEmail.get(normalizedEmail);
  if (!userId) return null;
  return findById(userId);
}

/**
 * Find user by email (including sensitive data - internal use only)
 */
export function findByEmailInternal(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const userId = usersByEmail.get(normalizedEmail);
  if (!userId) return null;
  return users.get(userId);
}

/**
 * Find user by OAuth provider
 */
export function findByOAuth(provider, providerId) {
  for (const user of users.values()) {
    if (user.oauth && 
        user.oauth.provider === provider && 
        user.oauth.providerId === providerId) {
      return sanitizeUser(user);
    }
  }
  return null;
}

/**
 * Find user by OAuth provider (internal)
 */
export function findByOAuthInternal(provider, providerId) {
  for (const user of users.values()) {
    if (user.oauth && 
        user.oauth.provider === provider && 
        user.oauth.providerId === providerId) {
      return user;
    }
  }
  return null;
}

/**
 * Update user
 */
export async function updateUser(id, updates) {
  const user = users.get(id);
  if (!user) {
    throw new Error('User not found');
  }
  
  // Handle email change
  if (updates.email && updates.email !== user.email) {
    const normalizedNewEmail = updates.email.toLowerCase().trim();
    if (usersByEmail.has(normalizedNewEmail)) {
      throw new Error('Email already registered');
    }
    usersByEmail.delete(user.email);
    usersByEmail.set(normalizedNewEmail, id);
    user.email = normalizedNewEmail;
  }
  
  // Handle username change
  if (updates.username && updates.username !== user.username) {
    for (const u of users.values()) {
      if (u.id !== id && u.username.toLowerCase() === updates.username.toLowerCase()) {
        throw new Error('Username already taken');
      }
    }
    user.username = updates.username.trim();
  }
  
  // Handle password change
  if (updates.password) {
    user.passwordHash = await bcrypt.hash(updates.password, 12);
  }
  
  // Update other fields
  const allowedFields = ['roles', 'permissions', 'isActive', 'isVerified', 'metadata', 'oauth'];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      user[field] = updates[field];
    }
  }
  
  user.updatedAt = new Date().toISOString();
  users.set(id, user);
  
  return sanitizeUser(user);
}

/**
 * Update last login timestamp
 */
export function updateLastLogin(id) {
  const user = users.get(id);
  if (user) {
    user.lastLoginAt = new Date().toISOString();
    users.set(id, user);
  }
}

/**
 * Delete user
 */
export function deleteUser(id) {
  const user = users.get(id);
  if (!user) {
    return false;
  }
  
  usersByEmail.delete(user.email);
  users.delete(id);
  
  // Clean up refresh tokens
  for (const [token, data] of refreshTokens.entries()) {
    if (data.userId === id) {
      refreshTokens.delete(token);
    }
  }
  
  return true;
}

/**
 * Verify user password
 */
export async function verifyPassword(user, password) {
  if (!user.passwordHash) {
    return false;
  }
  return bcrypt.compare(password, user.passwordHash);
}

/**
 * List all users (paginated)
 */
export function listUsers({ page = 1, limit = 20, includeInactive = false } = {}) {
  let allUsers = Array.from(users.values());
  
  if (!includeInactive) {
    allUsers = allUsers.filter(u => u.isActive);
  }
  
  const total = allUsers.length;
  const offset = (page - 1) * limit;
  const paginatedUsers = allUsers.slice(offset, offset + limit);
  
  return {
    users: paginatedUsers.map(sanitizeUser),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Store refresh token
 */
export function storeRefreshToken(token, userId, expiresAt, metadata = {}) {
  refreshTokens.set(token, {
    userId,
    expiresAt,
    createdAt: new Date().toISOString(),
    metadata
  });
}

/**
 * Validate and get refresh token data
 */
export function getRefreshToken(token) {
  const data = refreshTokens.get(token);
  if (!data) return null;
  
  // Check expiration
  if (new Date(data.expiresAt) < new Date()) {
    refreshTokens.delete(token);
    return null;
  }
  
  return data;
}

/**
 * Revoke refresh token
 */
export function revokeRefreshToken(token) {
  return refreshTokens.delete(token);
}

/**
 * Revoke all refresh tokens for user
 */
export function revokeAllUserTokens(userId) {
  let count = 0;
  for (const [token, data] of refreshTokens.entries()) {
    if (data.userId === userId) {
      refreshTokens.delete(token);
      count++;
    }
  }
  return count;
}

/**
 * Remove sensitive fields from user object
 */
function sanitizeUser(user) {
  const { passwordHash, ...sanitized } = user;
  return sanitized;
}

/**
 * Get user count
 */
export function getUserCount() {
  return users.size;
}

/**
 * Check if user has specific role
 */
export function hasRole(user, role) {
  return user.roles.includes(role) || user.roles.includes('admin');
}

/**
 * Check if user has specific permission
 */
export function hasPermission(user, permission) {
  // Admin has all permissions
  if (user.roles.includes('admin') || user.permissions.includes('*')) {
    return true;
  }
  
  // Check direct permission
  if (user.permissions.includes(permission)) {
    return true;
  }
  
  // Check wildcard permissions (e.g., 'users:*' matches 'users:read')
  const [resource] = permission.split(':');
  if (user.permissions.includes(`${resource}:*`)) {
    return true;
  }
  
  return false;
}

export default {
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
  hasPermission
};
