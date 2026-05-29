import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface BulkheadOptions {
  /** Name used in log messages */
  name: string;
  /** Max simultaneous in-flight requests before new ones are queued */
  maxConcurrent: number;
  /** Max queued requests before shedding load with 503 */
  maxQueueSize: number;
  /** How long (ms) a queued request waits before giving up (default: 30_000) */
  queueTimeoutMs?: number;
}

/**
 * Creates an Express middleware that isolates a route group behind a concurrency
 * semaphore.  Requests beyond `maxConcurrent` are queued; requests beyond
 * `maxConcurrent + maxQueueSize` are rejected immediately with 503.
 *
 * Usage:
 *   const aiBulkhead = createBulkhead({ name: 'ai', maxConcurrent: 10, maxQueueSize: 20 });
 *   app.use('/api/v1/ai', aiBulkhead);
 */
export function createBulkhead(opts: BulkheadOptions) {
  const { name, maxConcurrent, maxQueueSize, queueTimeoutMs = 30_000 } = opts;

  let active = 0;
  const queue: Array<() => void> = [];

  function release() {
    active = Math.max(0, active - 1);
    if (queue.length > 0) {
      const next = queue.shift()!;
      active++;
      next();
    }
  }

  function attachRelease(res: Response) {
    res.on('finish', release);
    res.on('close', release);
  }

  return function bulkheadMiddleware(req: Request, res: Response, next: NextFunction) {
    // Slot available — pass straight through
    if (active < maxConcurrent) {
      active++;
      attachRelease(res);
      next();
      return;
    }

    // Queue full — shed load immediately
    if (queue.length >= maxQueueSize) {
      logger.warn(`[Bulkhead:${name}] Queue full (${maxQueueSize}). Shedding request.`, {
        method: req.method,
        url: req.originalUrl,
        active,
      });
      res.status(503).set('Retry-After', '5').json({
        success: false,
        message: 'Server is temporarily overloaded. Please retry in a few seconds.',
      });
      return;
    }

    // Park the request in the queue
    let settled = false;

    const proceed = () => {
      if (settled) {
        // We already timed out — release the slot we were about to use
        release();
        return;
      }
      settled = true;
      clearTimeout(timer);
      attachRelease(res);
      next();
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const idx = queue.indexOf(proceed);
      if (idx !== -1) queue.splice(idx, 1);
      logger.warn(`[Bulkhead:${name}] Request timed out in queue after ${queueTimeoutMs}ms`, {
        url: req.originalUrl,
      });
      res.status(503).set('Retry-After', '5').json({
        success: false,
        message: 'Request timed out waiting for a server slot. Please retry.',
      });
    }, queueTimeoutMs);

    queue.push(proceed);
    logger.debug(`[Bulkhead:${name}] Queued. active=${active}, queue=${queue.length}/${maxQueueSize}`);
  };
}

// ---------------------------------------------------------------------------
// Pre-built bulkheads — import these directly in app.ts
// ---------------------------------------------------------------------------

/**
 * AI / Groq route bulkhead.
 * LLM calls are slow and Groq has rate limits, so keep concurrency low.
 */
export const aiBulkhead = createBulkhead({
  name: 'ai',
  maxConcurrent: 10,
  maxQueueSize: 20,
  queueTimeoutMs: 60_000,
});

/**
 * File upload (Cloudinary) bulkhead.
 * Uploads are I/O-heavy and memory-bound; limit hard.
 */
export const uploadBulkhead = createBulkhead({
  name: 'upload',
  maxConcurrent: 5,
  maxQueueSize: 10,
  queueTimeoutMs: 120_000,
});

/**
 * General API bulkhead — catches everything else.
 * High limits; mainly a circuit-breaker-of-last-resort against extreme spikes.
 */
export const generalBulkhead = createBulkhead({
  name: 'general',
  maxConcurrent: 150,
  maxQueueSize: 100,
  queueTimeoutMs: 30_000,
});
