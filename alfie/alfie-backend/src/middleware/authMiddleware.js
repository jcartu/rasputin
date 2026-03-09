import config from '../config.js';
import * as jwtService from '../services/jwtService.js';
import * as apiKeyService from '../services/apiKeyService.js';
import * as rbacService from '../services/rbacService.js';
import * as User from '../services/userService.js';

function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  
  return token;
}

function extractApiKey(req) {
  return req.headers['x-api-key'] || req.query.api_key || null;
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.socket?.remoteAddress ||
         req.ip;
}

export function authenticate(options = {}) {
  const { 
    required = true,
    allowApiKey = true,
    allowJwt = true
  } = options;

  return async (req, res, next) => {
    req.auth = {
      authenticated: false,
      method: null,
      user: null,
      apiKey: null,
      permissions: new Set()
    };

    const apiKey = allowApiKey ? extractApiKey(req) : null;
    if (apiKey) {
      const validation = await apiKeyService.validateApiKey(apiKey);
      
      if (validation.valid) {
        const clientIp = getClientIp(req);
        if (!apiKeyService.checkIpRestriction(validation, clientIp)) {
          return res.status(403).json({ 
            error: 'Access denied',
            message: 'IP address not allowed'
          });
        }

        const origin = req.headers.origin;
        if (!apiKeyService.checkOriginRestriction(validation, origin)) {
          return res.status(403).json({
            error: 'Access denied',
            message: 'Origin not allowed'
          });
        }

        const user = await User.findById(validation.userId);
        if (!user || !user.isActive) {
          return res.status(403).json({
            error: 'Access denied',
            message: 'API key owner account is disabled'
          });
        }

        req.auth = {
          authenticated: true,
          method: 'apikey',
          user,
          apiKey: {
            id: validation.keyId,
            permissions: validation.permissions,
            rateLimit: validation.rateLimit
          },
          permissions: new Set(validation.permissions)
        };

        return next();
      }
    }

    const token = allowJwt ? extractBearerToken(req) : null;
    if (token) {
      const verification = jwtService.verifyAccessToken(token);
      
      if (verification.valid) {
        const user = await User.findById(verification.payload.sub);
        
        if (!user) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'User not found'
          });
        }

        if (!user.isActive) {
          return res.status(403).json({
            error: 'Access denied',
            message: 'Account is disabled'
          });
        }

        const permissions = rbacService.getPermissionsForRoles(user.roles);
        for (const perm of user.permissions || []) {
          permissions.add(perm);
        }

        req.auth = {
          authenticated: true,
          method: 'jwt',
          user,
          apiKey: null,
          permissions
        };

        return next();
      }

      if (verification.expired) {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Access token has expired',
          code: 'TOKEN_EXPIRED'
        });
      }
    }

    if (required) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    next();
  };
}

export function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.auth?.authenticated) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const hasPermission = requiredPermissions.some(perm => 
      rbacService.hasPermission(req.auth.permissions, perm)
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        required: requiredPermissions
      });
    }

    next();
  };
}

export function requireAllPermissions(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.auth?.authenticated) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const missingPermissions = requiredPermissions.filter(perm => 
      !rbacService.hasPermission(req.auth.permissions, perm)
    );

    if (missingPermissions.length > 0) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        missing: missingPermissions
      });
    }

    next();
  };
}

export function requireRole(...requiredRoles) {
  return (req, res, next) => {
    if (!req.auth?.authenticated) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const hasRole = requiredRoles.some(role => 
      rbacService.userHasRole(req.auth.user, role)
    );

    if (!hasRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient role',
        required: requiredRoles
      });
    }

    next();
  };
}

export function requireOwnerOrPermission(getUserId, permission) {
  return (req, res, next) => {
    if (!req.auth?.authenticated) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const resourceUserId = typeof getUserId === 'function' 
      ? getUserId(req) 
      : req.params[getUserId];

    const isOwner = req.auth.user.id === resourceUserId;
    const hasPermission = rbacService.hasPermission(req.auth.permissions, permission);

    if (!isOwner && !hasPermission) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this resource'
      });
    }

    req.auth.isOwner = isOwner;
    next();
  };
}

export async function authenticateWs(token) {
  if (!token) return { authenticated: false, error: 'No token provided' };

  if (token.startsWith('alfie_')) {
    return { authenticated: false, error: 'API keys not supported for WebSocket' };
  }

  const verification = jwtService.verifyAccessToken(token);
  
  if (!verification.valid) {
    return { 
      authenticated: false, 
      error: verification.error,
      expired: verification.expired 
    };
  }

  const user = await User.findById(verification.payload.sub);
  if (!user || !user.isActive) {
    return { authenticated: false, error: 'User not found or disabled' };
  }

  const permissions = rbacService.getPermissionsForRoles(user.roles);
  for (const perm of user.permissions || []) {
    permissions.add(perm);
  }

  return {
    authenticated: true,
    user,
    permissions
  };
}

export function legacyAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  
  const [scheme, token] = authHeader.split(' ');
  
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <token>' });
  }
  
  if (token === config.apiToken) {
    req.auth = {
      authenticated: true,
      method: 'legacy',
      user: null,
      permissions: new Set(['*'])
    };
    return next();
  }

  return authenticate({ required: true })(req, res, next);
}

export default {
  authenticate,
  requirePermission,
  requireAllPermissions,
  requireRole,
  requireOwnerOrPermission,
  authenticateWs,
  legacyAuthenticate
};
