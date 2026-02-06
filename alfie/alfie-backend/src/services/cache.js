import Redis from 'ioredis';
import config from '../config.js';

let redis = null;
let isConnected = false;

function getClient() {
  if (!redis) {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      keyPrefix: config.redis.keyPrefix,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });

    redis.on('connect', () => {
      isConnected = true;
    });

    redis.on('error', (err) => {
      isConnected = false;
      console.warn('Redis connection error:', err.message);
    });

    redis.on('close', () => {
      isConnected = false;
    });

    redis.connect().catch(() => {});
  }
  return redis;
}

export async function get(key) {
  if (!isConnected) return null;
  try {
    const data = await getClient().get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function set(key, value, ttl = config.redis.defaultTTL) {
  if (!isConnected) return false;
  try {
    const serialized = JSON.stringify(value);
    if (ttl > 0) {
      await getClient().setex(key, ttl, serialized);
    } else {
      await getClient().set(key, serialized);
    }
    return true;
  } catch {
    return false;
  }
}

export async function del(key) {
  if (!isConnected) return false;
  try {
    await getClient().del(key);
    return true;
  } catch {
    return false;
  }
}

export async function exists(key) {
  if (!isConnected) return false;
  try {
    return (await getClient().exists(key)) === 1;
  } catch {
    return false;
  }
}

export function isReady() {
  return isConnected;
}

export async function close() {
  if (redis) {
    await redis.quit();
    redis = null;
    isConnected = false;
  }
}

export default { get, set, del, exists, isReady, close };
