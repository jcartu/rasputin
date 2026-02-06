import rateLimit from 'express-rate-limit';
import config from '../config.js';

const userRequestCounts = new Map();
const apiKeyRequestCounts = new Map();

function cleanupInterval() {
  const now = Date.now();
  const windowMs = 60000;
  
  for (const [key, data] of userRequestCounts.entries()) {
    if (now - data.windowStart > windowMs) {
      userRequestCounts.delete(key);
    }
  }
  
  for (const [key, data] of apiKeyRequestCounts.entries()) {
    if (now - data.windowStart > windowMs) {
      apiKeyRequestCounts.delete(key);
    }
  }
}

setInterval(cleanupInterval, 60000);

function getIdentifier(req) {
  if (req.auth?.authenticated) {
    if (req.auth.method === 'apikey' && req.auth.apiKey?.id) {
      return { type: 'apikey', id: req.auth.apiKey.id };
    }
    if (req.auth.user?.id) {
      return { type: 'user', id: req.auth.user.id };
    }
  }
  
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
             req.headers['x-real-ip'] ||
             req.socket?.remoteAddress ||
             req.ip;
  
  return { type: 'ip', id: ip };
}

function getRateLimit(req) {
  if (req.auth?.apiKey?.rateLimit > 0) {
    return req.auth.apiKey.rateLimit;
  }
  
  if (req.auth?.authenticated && req.auth.user) {
    const roles = req.auth.user.roles || [];
    if (roles.includes('admin')) return config.rateLimit.admin;
    if (roles.includes('power_user')) return config.rateLimit.powerUser;
    if (roles.includes('service')) return config.rateLimit.service;
    return config.rateLimit.user;
  }
  
  return config.rateLimit.anonymous;
}

export function perUserRateLimit(options = {}) {
  const {
    windowMs = 60000,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return (req, res, next) => {
    const identifier = getIdentifier(req);
    const limit = getRateLimit(req);
    const key = `${identifier.type}:${identifier.id}`;
    const now = Date.now();

    const store = identifier.type === 'apikey' ? apiKeyRequestCounts : userRequestCounts;
    
    let data = store.get(key);
    if (!data || now - data.windowStart > windowMs) {
      data = { count: 0, windowStart: now };
    }

    data.count++;
    store.set(key, data);

    const remaining = Math.max(0, limit - data.count);
    const resetTime = new Date(data.windowStart + windowMs);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime.toISOString());

    if (data.count > limit) {
      const retryAfter = Math.ceil((data.windowStart + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message,
        limit,
        remaining: 0,
        resetAt: resetTime.toISOString(),
        retryAfter
      });
    }

    const originalEnd = res.end;
    res.end = function(...args) {
      if (skipSuccessfulRequests && res.statusCode < 400) {
        data.count--;
        store.set(key, data);
      }
      if (skipFailedRequests && res.statusCode >= 400) {
        data.count--;
        store.set(key, data);
      }
      return originalEnd.apply(this, args);
    };

    next();
  };
}

export function endpointRateLimit(options = {}) {
  const {
    windowMs = 60000,
    max = 100,
    message = 'Too many requests to this endpoint',
    keyGenerator = null
  } = options;

  const store = new Map();

  return (req, res, next) => {
    const identifier = getIdentifier(req);
    const endpoint = `${req.method}:${req.baseUrl}${req.path}`;
    const key = keyGenerator 
      ? keyGenerator(req) 
      : `${identifier.type}:${identifier.id}:${endpoint}`;
    
    const now = Date.now();
    let data = store.get(key);
    
    if (!data || now - data.windowStart > windowMs) {
      data = { count: 0, windowStart: now };
    }

    data.count++;
    store.set(key, data);

    if (data.count > max) {
      const retryAfter = Math.ceil((data.windowStart + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message,
        retryAfter
      });
    }

    next();
  };
}

export const globalRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.global,
  message: { 
    error: 'Too many requests',
    message: 'Global rate limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again in 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    error: 'Rate limit exceeded',
    message: 'This endpoint has strict rate limiting'
  },
  standardHeaders: true,
  legacyHeaders: false
});

export function getRateLimitStats() {
  return {
    userRequests: userRequestCounts.size,
    apiKeyRequests: apiKeyRequestCounts.size,
    totalTracked: userRequestCounts.size + apiKeyRequestCounts.size
  };
}

export default {
  perUserRateLimit,
  endpointRateLimit,
  globalRateLimit,
  authRateLimit,
  strictRateLimit,
  getRateLimitStats
};
