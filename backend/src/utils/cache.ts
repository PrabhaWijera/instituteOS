import redis from '../config/redis';
import logger from './logger';

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Get a value from Redis cache, or execute the fetcher and cache the result.
 */
export async function cacheGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return (typeof cached === 'string' ? JSON.parse(cached) : cached) as T;
    }
  } catch (err) {
    logger.warn('Cache read failed, falling through to fetcher', { key, error: (err as Error).message });
  }

  const data = await fetcher();

  try {
    await redis.set(key, JSON.stringify(data), { ex: ttlSeconds });
  } catch (err) {
    logger.warn('Cache write failed', { key, error: (err as Error).message });
  }

  return data;
}

/**
 * Invalidate one or more cache keys.
 */
export async function cacheInvalidate(...keys: string[]): Promise<void> {
  try {
    for (const key of keys) {
      await redis.del(key);
    }
  } catch (err) {
    logger.warn('Cache invalidation failed', { keys, error: (err as Error).message });
  }
}

/**
 * Generate a consistent cache key.
 */
export function cacheKey(prefix: string, ...parts: (string | number | undefined)[]): string {
  return `cache:${prefix}:${parts.filter(Boolean).join(':')}`;
}
