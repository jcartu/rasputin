import * as cache from '../services/cache.js';
import config from '../config.js';

export function cacheResponse(options = {}) {
  const ttl = options.ttl || config.redis.defaultTTL;
  const keyGenerator = options.keyGenerator || defaultKeyGenerator;

  return async (req, res, next) => {
    if (!cache.isReady() || req.method !== 'GET') {
      return next();
    }

    const cacheKey = keyGenerator(req);
    
    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }
    } catch {
      return next();
    }

    res.set('X-Cache', 'MISS');
    
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, data, ttl).catch(() => {});
      }
      return originalJson(data);
    };

    next();
  };
}

function defaultKeyGenerator(req) {
  const userId = req.user?.id || 'anon';
  return `cache:${userId}:${req.originalUrl}`;
}

export function clearCache(pattern) {
  return async (req, res, next) => {
    if (pattern) {
      await cache.del(pattern);
    }
    next();
  };
}

export default { cacheResponse, clearCache };
