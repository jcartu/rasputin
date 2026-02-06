import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config.js';
import * as User from '../models/User.js';

/**
 * JWT Service for token generation, verification, and refresh
 */

// Token blacklist (for logout/revocation)
const tokenBlacklist = new Set();

/**
 * Generate access token
 */
export function generateAccessToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    username: user.username,
    roles: user.roles,
    permissions: user.permissions,
    type: 'access'
  };
  
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(user, metadata = {}) {
  const tokenId = crypto.randomBytes(32).toString('hex');
  const expiresIn = config.jwt.refreshExpiresIn;
  
  // Calculate expiration date
  const expiresAt = new Date();
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (match) {
    const [, value, unit] = match;
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    expiresAt.setTime(expiresAt.getTime() + parseInt(value) * multipliers[unit]);
  } else {
    // Default to 7 days
    expiresAt.setDate(expiresAt.getDate() + 7);
  }
  
  const payload = {
    sub: user.id,
    jti: tokenId,
    type: 'refresh'
  };
  
  const token = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience
  });
  
  // Store refresh token for validation
  User.storeRefreshToken(tokenId, user.id, expiresAt.toISOString(), metadata);
  
  return { token, expiresAt: expiresAt.toISOString() };
}

/**
 * Generate token pair (access + refresh)
 */
export function generateTokenPair(user, metadata = {}) {
  const accessToken = generateAccessToken(user);
  const { token: refreshToken, expiresAt: refreshExpiresAt } = generateRefreshToken(user, metadata);
  
  // Decode access token to get expiration
  const decoded = jwt.decode(accessToken);
  
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: decoded.exp - Math.floor(Date.now() / 1000),
    refreshExpiresAt
  };
}

/**
 * Verify access token
 */
export function verifyAccessToken(token) {
  try {
    // Check blacklist
    if (tokenBlacklist.has(token)) {
      return { valid: false, error: 'Token has been revoked' };
    }
    
    const decoded = jwt.verify(token, config.jwt.accessSecret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience
    });
    
    if (decoded.type !== 'access') {
      return { valid: false, error: 'Invalid token type' };
    }
    
    return { valid: true, payload: decoded };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Token expired', expired: true };
    }
    if (error.name === 'JsonWebTokenError') {
      return { valid: false, error: 'Invalid token' };
    }
    return { valid: false, error: error.message };
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience
    });
    
    if (decoded.type !== 'refresh') {
      return { valid: false, error: 'Invalid token type' };
    }
    
    // Check if refresh token is stored and valid
    const storedToken = User.getRefreshToken(decoded.jti);
    if (!storedToken) {
      return { valid: false, error: 'Refresh token not found or expired' };
    }
    
    if (storedToken.userId !== decoded.sub) {
      return { valid: false, error: 'Token user mismatch' };
    }
    
    return { valid: true, payload: decoded, tokenId: decoded.jti };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Refresh token expired', expired: true };
    }
    if (error.name === 'JsonWebTokenError') {
      return { valid: false, error: 'Invalid refresh token' };
    }
    return { valid: false, error: error.message };
  }
}

/**
 * Refresh tokens using refresh token
 */
export async function refreshTokens(refreshToken, metadata = {}) {
  const verification = verifyRefreshToken(refreshToken);
  
  if (!verification.valid) {
    throw new Error(verification.error);
  }
  
  const user = User.findByIdInternal(verification.payload.sub);
  if (!user) {
    throw new Error('User not found');
  }
  
  if (!user.isActive) {
    throw new Error('User account is disabled');
  }
  
  // Revoke old refresh token (token rotation)
  User.revokeRefreshToken(verification.tokenId);
  
  // Generate new token pair
  return generateTokenPair(user, metadata);
}

/**
 * Blacklist access token (for logout)
 */
export function blacklistToken(token) {
  try {
    // Decode without verification to get expiration
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      tokenBlacklist.add(token);
      
      // Schedule removal after token expires
      const expiresIn = (decoded.exp * 1000) - Date.now();
      if (expiresIn > 0) {
        setTimeout(() => {
          tokenBlacklist.delete(token);
        }, expiresIn);
      }
      
      return true;
    }
  } catch {
    // Ignore decode errors
  }
  return false;
}

/**
 * Revoke all tokens for user
 */
export function revokeAllUserTokens(userId) {
  return User.revokeAllUserTokens(userId);
}

/**
 * Decode token without verification (for extracting info)
 */
export function decodeToken(token) {
  return jwt.decode(token);
}

/**
 * Generate password reset token
 */
export function generatePasswordResetToken(userId) {
  const payload = {
    sub: userId,
    type: 'password_reset',
    jti: crypto.randomBytes(16).toString('hex')
  };
  
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: '1h',
    issuer: config.jwt.issuer
  });
}

/**
 * Verify password reset token
 */
export function verifyPasswordResetToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret, {
      issuer: config.jwt.issuer
    });
    
    if (decoded.type !== 'password_reset') {
      return { valid: false, error: 'Invalid token type' };
    }
    
    return { valid: true, userId: decoded.sub };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Reset token expired' };
    }
    return { valid: false, error: 'Invalid reset token' };
  }
}

/**
 * Generate email verification token
 */
export function generateEmailVerificationToken(userId, email) {
  const payload = {
    sub: userId,
    email,
    type: 'email_verification',
    jti: crypto.randomBytes(16).toString('hex')
  };
  
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: '24h',
    issuer: config.jwt.issuer
  });
}

/**
 * Verify email verification token
 */
export function verifyEmailVerificationToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret, {
      issuer: config.jwt.issuer
    });
    
    if (decoded.type !== 'email_verification') {
      return { valid: false, error: 'Invalid token type' };
    }
    
    return { valid: true, userId: decoded.sub, email: decoded.email };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Verification token expired' };
    }
    return { valid: false, error: 'Invalid verification token' };
  }
}

export default {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  refreshTokens,
  blacklistToken,
  revokeAllUserTokens,
  decodeToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  generateEmailVerificationToken,
  verifyEmailVerificationToken
};
