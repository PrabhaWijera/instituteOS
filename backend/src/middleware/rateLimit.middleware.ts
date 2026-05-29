import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// IP-based limiters (existing — unchanged)
// ---------------------------------------------------------------------------

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------------------------------------------------------------------------
// Per-user rate limiter — Redis-backed, keyed by authenticated userId
//
// Bypasses proxy-based spoofing of IP addresses because the limit is tied to
// the verified JWT identity.  Falls open (passes the request) if Redis is
// unavailable so a Redis outage never causes a service outage.
//
// Usage:
//   router.use(userRateLimit({ max: 60, windowSec: 60 }))   // 60 req/min per user
//   router.post('/ai/chat', userRateLimit({ max: 20, windowSec: 60 }), ...)
// ---------------------------------------------------------------------------

export interface UserRateLimitOptions {
  /** Maximum requests allowed in the window (default: 60) */
  max?: number;
  /** Window size in seconds (default: 60) */
  windowSec?: number;
  /** Human-readable label shown in log messages (default: 'api') */
  name?: string;
}

export function userRateLimit(opts: UserRateLimitOptions = {}) {
  const { max = 60, windowSec = 60, name = 'api' } = opts;

  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    // Not authenticated — no user-level throttle (IP limiter still applies upstream)
    if (!userId) return next();

    const key = `ratelimit:user:${name}:${userId}`;

    try {
      // Atomic pipeline: incr + expire (only set expiry on first hit)
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, windowSec, 'NX'); // NX = only set if key has no TTL yet
      const results = await pipeline.exec();

      const current = (results[0] as number) ?? 1;
      const ttl = await redis.ttl(key);
      const resetTimestamp = Date.now() + Math.max(ttl, 0) * 1000;

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetTimestamp / 1000)); // Unix seconds

      if (current > max) {
        logger.warn('[RateLimit] Per-user limit exceeded', {
          userId,
          limiter: name,
          requests: current,
          max,
          windowSec,
        });
        res
          .status(429)
          .set('Retry-After', String(Math.max(ttl, 1)))
          .json({
            success: false,
            message: `Rate limit exceeded. Maximum ${max} requests per ${windowSec}s. Try again in ${Math.max(ttl, 1)}s.`,
          });
        return;
      }
    } catch (err) {
      // Redis failure → fail open (never let a rate-limit cache outage block legit traffic)
      logger.warn('[RateLimit] Redis error — failing open', {
        limiter: name,
        error: (err as Error).message,
      });
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Pre-built per-user limiters for commonly throttled routes
// ---------------------------------------------------------------------------

/** AI / LLM route: 20 calls per minute per user */
export const aiUserLimiter = userRateLimit({ max: 20, windowSec: 60, name: 'ai' });

/** Auth sensitive actions: 5 per 5 minutes per user */
export const sensitiveUserLimiter = userRateLimit({ max: 5, windowSec: 300, name: 'sensitive' });

/** General authenticated API: 120 per minute per user */
export const generalUserLimiter = userRateLimit({ max: 120, windowSec: 60, name: 'general' });
