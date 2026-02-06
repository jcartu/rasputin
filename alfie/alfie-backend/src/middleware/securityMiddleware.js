import helmet from 'helmet';
import crypto from 'crypto';
import config from '../config.js';

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
});

const csrfTokens = new Map();

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function csrfProtection(req, res, next) {
  if (!config.security.csrfEnabled) {
    return next();
  }

  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  if (req.headers['x-api-key'] || req.headers.authorization?.startsWith('Bearer alfie_')) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body?._csrf;
  const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;

  if (!token || !sessionId) {
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Missing CSRF token or session'
    });
  }

  const storedToken = csrfTokens.get(sessionId);
  if (!storedToken || storedToken.token !== token) {
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Invalid CSRF token'
    });
  }

  if (Date.now() > storedToken.expiresAt) {
    csrfTokens.delete(sessionId);
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'CSRF token expired'
    });
  }

  next();
}

export function generateCsrfTokenEndpoint(req, res) {
  const sessionId = req.headers['x-session-id'] || crypto.randomBytes(16).toString('hex');
  const token = generateCsrfToken();
  const expiresAt = Date.now() + (60 * 60 * 1000);

  csrfTokens.set(sessionId, { token, expiresAt });

  setTimeout(() => {
    const stored = csrfTokens.get(sessionId);
    if (stored && stored.token === token) {
      csrfTokens.delete(sessionId);
    }
  }, 60 * 60 * 1000);

  res.json({
    csrfToken: token,
    sessionId,
    expiresAt: new Date(expiresAt).toISOString()
  });
}

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  res.removeHeader('X-Powered-By');
  
  next();
}

export function requestSanitizer(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    sanitizeObject(req.params);
  }
  next();
}

function sanitizeObject(obj) {
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.startsWith('__')) {
      delete obj[key];
      continue;
    }
    
    if (typeof obj[key] === 'string') {
      obj[key] = obj[key]
        .split('')
        .filter(char => {
          const code = char.charCodeAt(0);
          return !(code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127);
        })
        .join('')
        .trim();
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

export function corsWithCredentials(allowedOrigins) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    
    if (!origin) {
      return next();
    }

    const isAllowed = allowedOrigins.includes('*') || 
                      allowedOrigins.includes(origin) ||
                      allowedOrigins.some(allowed => {
                        if (allowed.startsWith('*.')) {
                          const domain = allowed.slice(2);
                          return origin.endsWith(domain);
                        }
                        return false;
                      });

    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 
        'Content-Type, Authorization, X-API-Key, X-CSRF-Token, X-Session-ID, X-Request-ID');
      res.setHeader('Access-Control-Expose-Headers', 
        'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Request-ID');
      res.setHeader('Access-Control-Max-Age', '86400');
    }

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  };
}

export function requestIdMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

export function errorHandler(err, req, res, next) {
  console.error(`[${req.requestId || 'no-id'}] Error:`, err);

  if (res.headersSent) {
    return next(err);
  }

  const isDev = config.nodeEnv === 'development';

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      ...(isDev && { stack: err.stack })
    });
  }

  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: err.message || 'Authentication required'
    });
  }

  if (err.status === 403) {
    return res.status(403).json({
      error: 'Forbidden',
      message: err.message || 'Access denied'
    });
  }

  if (err.status === 404) {
    return res.status(404).json({
      error: 'Not Found',
      message: err.message || 'Resource not found'
    });
  }

  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: isDev ? err.message : 'An unexpected error occurred',
    ...(isDev && { stack: err.stack })
  });
}

export default {
  helmetMiddleware,
  csrfProtection,
  generateCsrfTokenEndpoint,
  securityHeaders,
  requestSanitizer,
  corsWithCredentials,
  requestIdMiddleware,
  errorHandler
};
