import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * API Key Management Service
 * Handles creation, validation, and management of API keys
 */

// In-memory API key storage
// Production: Replace with database
const apiKeys = new Map();
const apiKeysByHash = new Map();

/**
 * API Key structure
 * @typedef {Object} ApiKey
 * @property {string} id - Unique key ID
 * @property {string} name - Human-readable name
 * @property {string} keyHash - Hashed API key (bcrypt)
 * @property {string} keyPrefix - First 8 chars for identification
 * @property {string} userId - Owner user ID
 * @property {string[]} permissions - Granted permissions
 * @property {string[]} allowedIps - IP whitelist (empty = all)
 * @property {string[]} allowedOrigins - Origin whitelist (empty = all)
 * @property {number} rateLimit - Requests per minute (0 = default)
 * @property {boolean} isActive - Key active status
 * @property {string} createdAt - Creation timestamp
 * @property {string|null} expiresAt - Expiration timestamp (null = never)
 * @property {string|null} lastUsedAt - Last usage timestamp
 * @property {number} usageCount - Total usage count
 * @property {Object} metadata - Additional metadata
 */

/**
 * Generate API key ID
 */
function generateKeyId() {
  return `key_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate secure API key
 * Format: alfie_{random_32_bytes_hex}
 */
function generateApiKey() {
  const randomPart = crypto.randomBytes(32).toString('hex');
  return `alfie_${randomPart}`;
}

/**
 * Create new API key
 */
export async function createApiKey({
  name,
  userId,
  permissions = [],
  allowedIps = [],
  allowedOrigins = [],
  rateLimit = 0,
  expiresIn = null, // Duration string like '30d', '1y', or null for never
  metadata = {}
}) {
  const id = generateKeyId();
  const rawKey = generateApiKey();
  const keyPrefix = rawKey.substring(0, 12); // 'alfie_' + first 6 chars
  
  // Hash the key for storage
  const keyHash = await bcrypt.hash(rawKey, 10);
  
  // Calculate expiration
  let expiresAt = null;
  if (expiresIn) {
    expiresAt = new Date();
    const match = expiresIn.match(/^(\d+)([dhmy])$/);
    if (match) {
      const [, value, unit] = match;
      const num = parseInt(value);
      switch (unit) {
        case 'd': expiresAt.setDate(expiresAt.getDate() + num); break;
        case 'h': expiresAt.setHours(expiresAt.getHours() + num); break;
        case 'm': expiresAt.setMonth(expiresAt.getMonth() + num); break;
        case 'y': expiresAt.setFullYear(expiresAt.getFullYear() + num); break;
      }
      expiresAt = expiresAt.toISOString();
    }
  }
  
  const now = new Date().toISOString();
  
  const apiKey = {
    id,
    name,
    keyHash,
    keyPrefix,
    userId,
    permissions,
    allowedIps,
    allowedOrigins,
    rateLimit,
    isActive: true,
    createdAt: now,
    expiresAt,
    lastUsedAt: null,
    usageCount: 0,
    metadata
  };
  
  apiKeys.set(id, apiKey);
  apiKeysByHash.set(keyHash, id);
  
  // Return the raw key only once (it cannot be retrieved later)
  return {
    id,
    name,
    key: rawKey, // Only returned on creation
    keyPrefix,
    permissions,
    expiresAt,
    createdAt: now
  };
}

/**
 * Validate API key and return associated data
 */
export async function validateApiKey(rawKey) {
  // Check format
  if (!rawKey || !rawKey.startsWith('alfie_')) {
    return { valid: false, error: 'Invalid key format' };
  }
  
  // Find matching key by checking against all hashes
  for (const [id, keyData] of apiKeys.entries()) {
    const isMatch = await bcrypt.compare(rawKey, keyData.keyHash);
    if (isMatch) {
      // Check if active
      if (!keyData.isActive) {
        return { valid: false, error: 'API key is disabled' };
      }
      
      // Check expiration
      if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
        return { valid: false, error: 'API key has expired' };
      }
      
      // Update usage stats
      keyData.lastUsedAt = new Date().toISOString();
      keyData.usageCount++;
      apiKeys.set(id, keyData);
      
      return {
        valid: true,
        keyId: id,
        userId: keyData.userId,
        permissions: keyData.permissions,
        rateLimit: keyData.rateLimit,
        allowedIps: keyData.allowedIps,
        allowedOrigins: keyData.allowedOrigins
      };
    }
  }
  
  return { valid: false, error: 'Invalid API key' };
}

/**
 * Check IP restriction
 */
export function checkIpRestriction(keyData, clientIp) {
  if (!keyData.allowedIps || keyData.allowedIps.length === 0) {
    return true; // No restriction
  }
  
  // Normalize IPs (handle IPv6-mapped IPv4)
  const normalizedClientIp = clientIp.replace(/^::ffff:/, '');
  
  return keyData.allowedIps.some(allowedIp => {
    const normalizedAllowed = allowedIp.replace(/^::ffff:/, '');
    // Support CIDR notation in future
    return normalizedClientIp === normalizedAllowed;
  });
}

/**
 * Check origin restriction
 */
export function checkOriginRestriction(keyData, origin) {
  if (!keyData.allowedOrigins || keyData.allowedOrigins.length === 0) {
    return true; // No restriction
  }
  
  if (!origin) {
    return false; // Origin required but not provided
  }
  
  return keyData.allowedOrigins.some(allowed => {
    if (allowed === '*') return true;
    if (allowed.startsWith('*.')) {
      // Wildcard subdomain
      const domain = allowed.slice(2);
      return origin.endsWith(domain) || origin === domain;
    }
    return origin === allowed;
  });
}

/**
 * Get API key by ID
 */
export function getApiKey(id) {
  const key = apiKeys.get(id);
  if (!key) return null;
  
  // Return without hash
  const { keyHash, ...sanitized } = key;
  return sanitized;
}

/**
 * List API keys for user
 */
export function listUserApiKeys(userId) {
  const userKeys = [];
  
  for (const key of apiKeys.values()) {
    if (key.userId === userId) {
      const { keyHash, ...sanitized } = key;
      userKeys.push(sanitized);
    }
  }
  
  return userKeys.sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );
}

/**
 * List all API keys (admin only)
 */
export function listAllApiKeys({ page = 1, limit = 20, includeInactive = false } = {}) {
  let allKeys = Array.from(apiKeys.values()).map(key => {
    const { keyHash, ...sanitized } = key;
    return sanitized;
  });
  
  if (!includeInactive) {
    allKeys = allKeys.filter(k => k.isActive);
  }
  
  // Sort by creation date descending
  allKeys.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const total = allKeys.length;
  const offset = (page - 1) * limit;
  const paginatedKeys = allKeys.slice(offset, offset + limit);
  
  return {
    keys: paginatedKeys,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Update API key
 */
export function updateApiKey(id, updates) {
  const key = apiKeys.get(id);
  if (!key) {
    throw new Error('API key not found');
  }
  
  const allowedUpdates = [
    'name', 'permissions', 'allowedIps', 'allowedOrigins', 
    'rateLimit', 'isActive', 'metadata'
  ];
  
  for (const field of allowedUpdates) {
    if (updates[field] !== undefined) {
      key[field] = updates[field];
    }
  }
  
  apiKeys.set(id, key);
  
  const { keyHash, ...sanitized } = key;
  return sanitized;
}

/**
 * Delete API key
 */
export function deleteApiKey(id) {
  const key = apiKeys.get(id);
  if (!key) {
    return false;
  }
  
  apiKeysByHash.delete(key.keyHash);
  apiKeys.delete(id);
  
  return true;
}

/**
 * Revoke (deactivate) API key
 */
export function revokeApiKey(id) {
  return updateApiKey(id, { isActive: false });
}

/**
 * Regenerate API key (creates new key, invalidates old)
 */
export async function regenerateApiKey(id) {
  const oldKey = apiKeys.get(id);
  if (!oldKey) {
    throw new Error('API key not found');
  }
  
  const rawKey = generateApiKey();
  const keyPrefix = rawKey.substring(0, 12);
  const keyHash = await bcrypt.hash(rawKey, 10);
  
  // Update with new hash
  apiKeysByHash.delete(oldKey.keyHash);
  oldKey.keyHash = keyHash;
  oldKey.keyPrefix = keyPrefix;
  apiKeys.set(id, oldKey);
  apiKeysByHash.set(keyHash, id);
  
  return {
    id,
    name: oldKey.name,
    key: rawKey,
    keyPrefix
  };
}

/**
 * Get API key count
 */
export function getApiKeyCount() {
  return apiKeys.size;
}

/**
 * Clean up expired keys
 */
export function cleanupExpiredKeys() {
  const now = new Date();
  let cleaned = 0;
  
  for (const [id, key] of apiKeys.entries()) {
    if (key.expiresAt && new Date(key.expiresAt) < now) {
      apiKeysByHash.delete(key.keyHash);
      apiKeys.delete(id);
      cleaned++;
    }
  }
  
  return cleaned;
}

export default {
  createApiKey,
  validateApiKey,
  checkIpRestriction,
  checkOriginRestriction,
  getApiKey,
  listUserApiKeys,
  listAllApiKeys,
  updateApiKey,
  deleteApiKey,
  revokeApiKey,
  regenerateApiKey,
  getApiKeyCount,
  cleanupExpiredKeys
};
