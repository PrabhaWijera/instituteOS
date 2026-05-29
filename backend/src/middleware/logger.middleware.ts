import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// PII field names that must never appear verbatim in logs
// ---------------------------------------------------------------------------
const PII_KEYS = new Set([
  'password', 'passwordHash', 'confirmPassword', 'newPassword', 'oldPassword',
  'token', 'refreshToken', 'accessToken', 'otp', 'otpCode', 'secret',
  'authorization', 'cookie', 'set-cookie',
  'creditCard', 'cardNumber', 'cvv', 'ssn',
  'dob', 'dateOfBirth', 'nationalId',
]);

/**
 * Deep-clone an object, replacing PII field values with '[REDACTED]'.
 * Handles nested objects and arrays up to 5 levels deep.
 */
function redact(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.slice(0, 20).map((item) => redact(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = PII_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(value, depth + 1);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Structured request / response logger
//
// Replaces the simple morgan middleware with a Winston-backed logger that
// captures: method, path, query, sanitised body, status, duration, userId,
// and a truncated response snapshot (production only logs status + duration).
// ---------------------------------------------------------------------------

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startAt = process.hrtime.bigint();

  // Capture response body for non-200 responses (error investigation)
  const originalJson = res.json.bind(res);
  let responseBody: unknown;

  res.json = function (body: unknown) {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startAt) / 1e6;
    const isProd = process.env.NODE_ENV === 'production';

    const logData: Record<string, unknown> = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userId: req.user?.userId ?? null,
      role: req.user?.role ?? null,
      ip: req.ip,
    };

    if (!isProd) {
      // Dev: include sanitised query + body for easier debugging
      if (Object.keys(req.query).length) logData.query = redact(req.query);
      if (req.body && Object.keys(req.body).length) logData.body = redact(req.body);
    }

    // Always include error details for failed requests
    if (res.statusCode >= 400 && responseBody) {
      logData.responseError = redact(responseBody);
    }

    const level =
      res.statusCode >= 500 ? 'error' :
      res.statusCode >= 400 ? 'warn' :
      durationMs > 2000 ? 'warn' :
      'http';

    logger.log(level, `${req.method} ${req.path} ${res.statusCode}`, logData);
  });

  next();
}
