import logger from './logger';

export interface RetryOptions {
  /** Maximum number of attempts including the first call (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms before first retry (default: 300) */
  initialDelayMs?: number;
  /** Upper bound on computed backoff delay in ms (default: 5_000) */
  maxDelayMs?: number;
  /** Exponential backoff multiplier (default: 2) */
  factor?: number;
  /** Add up to 50 % random jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** Called before each retry; return false to stop retrying immediately */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  /** Logged in warning messages to identify the operation */
  operationName?: string;
}

/**
 * Returns true for errors that are safe to retry:
 *   - Network / connection failures
 *   - HTTP 429 Too Many Requests
 *   - HTTP 5xx Server Errors
 * Never retries 4xx client errors (they won't change on retry).
 */
function isTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes('econnreset') ||
      msg.includes('econnrefused') ||
      msg.includes('etimedout') ||
      msg.includes('socket hang up') ||
      msg.includes('network') ||
      msg.includes('timed out') ||
      msg.includes('fetch failed')
    ) {
      return true;
    }
  }

  const status =
    (err as any)?.status ??
    (err as any)?.statusCode ??
    (err as any)?.response?.status;

  if (typeof status === 'number') {
    return status === 429 || status >= 500;
  }

  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 300,
    maxDelayMs = 5_000,
    factor = 2,
    jitter = true,
    shouldRetry = isTransientError,
    operationName = 'operation',
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts || !shouldRetry(err, attempt)) {
        throw err;
      }

      // Exponential backoff: delay = min(maxDelay, initial * factor^(attempt-1))
      let delay = Math.min(maxDelayMs, initialDelayMs * Math.pow(factor, attempt - 1));
      // Optional jitter: multiply by a random factor in [0.5, 1.0]
      if (jitter) delay = delay * (0.5 + Math.random() * 0.5);

      logger.warn(
        `[Retry] ${operationName} attempt ${attempt}/${maxAttempts} failed — retrying in ${Math.round(delay)}ms`,
        { error: err instanceof Error ? err.message : String(err) },
      );

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
