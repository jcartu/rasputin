import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import * as sessionManager from './sessionManager.js';

// In-memory store for shares (in production, use a database)
const shares = new Map();
const snapshots = new Map();

/**
 * Generate a secure share token
 */
function generateShareToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Hash a password for secure storage
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Verify a password against its hash
 */
function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

/**
 * Create a snapshot of a session's current state
 */
export function createSnapshot(sessionId, options = {}) {
  const session = sessionManager.getLocalSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const snapshotId = uuidv4();
  const snapshot = {
    id: snapshotId,
    sessionId,
    name: options.name || `Snapshot ${new Date().toISOString()}`,
    description: options.description || '',
    createdAt: new Date().toISOString(),
    data: {
      messages: JSON.parse(JSON.stringify(session.messages)),
      metadata: { ...session.metadata },
      createdAt: session.createdAt,
    },
  };

  snapshots.set(snapshotId, snapshot);
  return snapshot;
}

/**
 * Get a snapshot by ID
 */
export function getSnapshot(snapshotId) {
  return snapshots.get(snapshotId) || null;
}

/**
 * List snapshots for a session
 */
export function listSnapshots(sessionId) {
  return Array.from(snapshots.values())
    .filter(s => s.sessionId === sessionId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Delete a snapshot
 */
export function deleteSnapshot(snapshotId) {
  return snapshots.delete(snapshotId);
}

/**
 * Create a new share for a session
 */
export function createShare(sessionId, options = {}) {
  const session = sessionManager.getLocalSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const shareId = uuidv4();
  const token = generateShareToken();

  // Calculate expiration
  let expiresAt = null;
  if (options.expiresIn) {
    const now = new Date();
    switch (options.expiresIn) {
      case '1h':
        expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
        break;
      case '24h':
        expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case '7d':
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      case 'never':
      default:
        expiresAt = null;
    }
  }

  // Create snapshot if requested
  let snapshotId = null;
  if (options.createSnapshot) {
    const snapshot = createSnapshot(sessionId, {
      name: options.snapshotName || 'Share Snapshot',
      description: `Snapshot created for share ${token.slice(0, 8)}`,
    });
    snapshotId = snapshot.id;
  }

  const share = {
    id: shareId,
    token,
    sessionId,
    snapshotId,
    
    // Permissions
    visibility: options.visibility || 'private', // 'public' | 'private' | 'unlisted'
    viewOnly: options.viewOnly !== false, // Default to view-only
    allowComments: options.allowComments || false,
    allowCopy: options.allowCopy || false,
    allowEmbed: options.allowEmbed || false,
    
    // Security
    passwordHash: options.password ? hashPassword(options.password) : null,
    maxViews: options.maxViews || null,
    allowedEmails: options.allowedEmails || [],
    
    // Metadata
    title: options.title || session.metadata?.name || 'Shared Session',
    description: options.description || '',
    createdAt: new Date().toISOString(),
    createdBy: options.createdBy || 'anonymous',
    expiresAt: expiresAt?.toISOString() || null,
    
    // Stats
    viewCount: 0,
    lastViewedAt: null,
  };

  shares.set(shareId, share);
  return {
    ...share,
    shareUrl: `/share/${token}`,
    embedCode: share.allowEmbed 
      ? `<iframe src="${process.env.PUBLIC_URL || 'http://localhost:3000'}/embed/${token}" width="100%" height="600" frameborder="0"></iframe>`
      : null,
  };
}

/**
 * Get share by ID
 */
export function getShareById(shareId) {
  return shares.get(shareId) || null;
}

/**
 * Get share by token
 */
export function getShareByToken(token) {
  for (const share of shares.values()) {
    if (share.token === token) {
      return share;
    }
  }
  return null;
}

/**
 * Validate share access
 */
export function validateShareAccess(token, options = {}) {
  const share = getShareByToken(token);
  
  if (!share) {
    return { valid: false, error: 'Share not found' };
  }

  // Check expiration
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return { valid: false, error: 'Share has expired' };
  }

  // Check max views
  if (share.maxViews && share.viewCount >= share.maxViews) {
    return { valid: false, error: 'Maximum views reached' };
  }

  // Check password
  if (share.passwordHash && !options.password) {
    return { valid: false, error: 'Password required', requiresPassword: true };
  }

  if (share.passwordHash && !verifyPassword(options.password, share.passwordHash)) {
    return { valid: false, error: 'Invalid password' };
  }

  // Check email access (for private shares)
  if (share.visibility === 'private' && share.allowedEmails.length > 0) {
    if (!options.email || !share.allowedEmails.includes(options.email.toLowerCase())) {
      return { valid: false, error: 'Access denied' };
    }
  }

  return { valid: true, share };
}

/**
 * Access a share (increments view count)
 */
export function accessShare(token, options = {}) {
  const validation = validateShareAccess(token, options);
  
  if (!validation.valid) {
    return validation;
  }

  const share = validation.share;
  
  // Increment view count
  share.viewCount++;
  share.lastViewedAt = new Date().toISOString();

  // Get session data
  let sessionData;
  if (share.snapshotId) {
    const snapshot = getSnapshot(share.snapshotId);
    if (snapshot) {
      sessionData = snapshot.data;
    }
  } else {
    const session = sessionManager.getLocalSession(share.sessionId);
    if (session) {
      sessionData = {
        messages: session.messages,
        metadata: session.metadata,
        createdAt: session.createdAt,
      };
    }
  }

  if (!sessionData) {
    return { valid: false, error: 'Session data not found' };
  }

  return {
    valid: true,
    share: {
      id: share.id,
      title: share.title,
      description: share.description,
      viewOnly: share.viewOnly,
      allowComments: share.allowComments,
      allowCopy: share.allowCopy,
      createdAt: share.createdAt,
      viewCount: share.viewCount,
    },
    session: sessionData,
  };
}

/**
 * Update a share
 */
export function updateShare(shareId, updates) {
  const share = shares.get(shareId);
  if (!share) {
    throw new Error('Share not found');
  }

  // Update allowed fields
  const allowedUpdates = [
    'title', 'description', 'visibility', 'viewOnly', 
    'allowComments', 'allowCopy', 'allowEmbed', 'maxViews', 
    'allowedEmails', 'expiresAt'
  ];

  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      share[key] = updates[key];
    }
  }

  // Handle password update
  if (updates.password === null) {
    share.passwordHash = null;
  } else if (updates.password) {
    share.passwordHash = hashPassword(updates.password);
  }

  return share;
}

/**
 * Delete a share
 */
export function deleteShare(shareId) {
  const share = shares.get(shareId);
  if (share?.snapshotId) {
    snapshots.delete(share.snapshotId);
  }
  return shares.delete(shareId);
}

/**
 * List shares for a session
 */
export function listSharesForSession(sessionId) {
  return Array.from(shares.values())
    .filter(s => s.sessionId === sessionId)
    .map(s => ({
      ...s,
      shareUrl: `/share/${s.token}`,
      hasPassword: !!s.passwordHash,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * List all shares (for dashboard)
 */
export function listAllShares(options = {}) {
  let shareList = Array.from(shares.values());

  // Filter by status
  if (options.status === 'active') {
    shareList = shareList.filter(s => 
      !s.expiresAt || new Date(s.expiresAt) > new Date()
    );
  } else if (options.status === 'expired') {
    shareList = shareList.filter(s => 
      s.expiresAt && new Date(s.expiresAt) <= new Date()
    );
  }

  // Filter by visibility
  if (options.visibility) {
    shareList = shareList.filter(s => s.visibility === options.visibility);
  }

  // Sort
  const sortField = options.sortBy || 'createdAt';
  const sortOrder = options.sortOrder || 'desc';
  shareList.sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  // Pagination
  const page = options.page || 1;
  const limit = options.limit || 20;
  const start = (page - 1) * limit;
  const end = start + limit;

  return {
    shares: shareList.slice(start, end).map(s => ({
      ...s,
      shareUrl: `/share/${s.token}`,
      hasPassword: !!s.passwordHash,
      isExpired: s.expiresAt && new Date(s.expiresAt) <= new Date(),
    })),
    total: shareList.length,
    page,
    limit,
    totalPages: Math.ceil(shareList.length / limit),
  };
}

/**
 * Get share statistics
 */
export function getShareStats() {
  const allShares = Array.from(shares.values());
  const now = new Date();

  return {
    total: allShares.length,
    active: allShares.filter(s => !s.expiresAt || new Date(s.expiresAt) > now).length,
    expired: allShares.filter(s => s.expiresAt && new Date(s.expiresAt) <= now).length,
    public: allShares.filter(s => s.visibility === 'public').length,
    private: allShares.filter(s => s.visibility === 'private').length,
    unlisted: allShares.filter(s => s.visibility === 'unlisted').length,
    passwordProtected: allShares.filter(s => !!s.passwordHash).length,
    totalViews: allShares.reduce((sum, s) => sum + s.viewCount, 0),
    snapshotsCount: snapshots.size,
  };
}

/**
 * Regenerate share token
 */
export function regenerateShareToken(shareId) {
  const share = shares.get(shareId);
  if (!share) {
    throw new Error('Share not found');
  }

  share.token = generateShareToken();
  return {
    ...share,
    shareUrl: `/share/${share.token}`,
  };
}

/**
 * Verify share password
 */
export function verifySharePassword(token, password) {
  const share = getShareByToken(token);
  if (!share) {
    return { valid: false, error: 'Share not found' };
  }

  if (!share.passwordHash) {
    return { valid: true, message: 'No password required' };
  }

  if (verifyPassword(password, share.passwordHash)) {
    return { valid: true };
  }

  return { valid: false, error: 'Invalid password' };
}

export default {
  createSnapshot,
  getSnapshot,
  listSnapshots,
  deleteSnapshot,
  createShare,
  getShareById,
  getShareByToken,
  validateShareAccess,
  accessShare,
  updateShare,
  deleteShare,
  listSharesForSession,
  listAllShares,
  getShareStats,
  regenerateShareToken,
  verifySharePassword,
};
