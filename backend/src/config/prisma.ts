import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

/**
 * Inject connection-pool query parameters into the DATABASE_URL if the
 * caller has not already set them.  This avoids silent "one connection per
 * process" behaviour under concurrent load.
 *
 * Prisma PostgreSQL pool params:
 *   connection_limit  — max open connections (default: num_cpus * 2 + 1)
 *   pool_timeout      — seconds to wait for a free connection (default: 10)
 *   connect_timeout   — seconds to wait when opening a new connection (default: 5)
 */
function buildDatabaseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '10');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '30');
    }
    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', '10');
    }
    return url.toString();
  } catch {
    // Non-standard URL (e.g. file: for SQLite in tests) — return as-is
    return raw;
  }
}

const isDev = process.env.NODE_ENV === 'development';

const prisma = new PrismaClient({
  datasourceUrl: buildDatabaseUrl(process.env.DATABASE_URL ?? ''),
  log: isDev
    ? [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ]
    : [{ emit: 'event', level: 'error' }],
});

// Slow-query detector (development only — too noisy in prod)
if (isDev) {
  (prisma as any).$on('query', (e: { query: string; params: string; duration: number }) => {
    if (e.duration > 500) {
      logger.warn('[Prisma] Slow query detected', {
        durationMs: e.duration,
        query: e.query.slice(0, 300),
      });
    }
  });
}

// Always log database-level errors
(prisma as any).$on('error', (e: { message: string; target: string }) => {
  logger.error('[Prisma] Database error', { target: e.target, error: e.message });
});

export default prisma;
