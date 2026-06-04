import { Request, Response, NextFunction } from 'express';

/** Fields that must keep valid URL characters (slashes, query strings, etc.) */
const URL_FIELD_KEYS = new Set([
  'url',
  'profileImage',
  'resetLink',
  'inviteLink',
  'imageUrl',
  'videoUrl',
  'liveUrl',
]);

/**
 * Strip HTML/script from URL values without entity-encoding slashes.
 */
function sanitizeUrlString(value: string): string {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .trim();
}

/**
 * Sanitize text fields for safe storage/display (not used for URLs).
 */
function sanitizeTextString(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function sanitizeValue(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    if (key && URL_FIELD_KEYS.has(key)) {
      return sanitizeUrlString(value);
    }
    return sanitizeTextString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    sanitized[key] = sanitizeValue(val, key);
  }
  return sanitized;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params.
 * Skips sanitization for file uploads (multipart).
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query as Record<string, unknown>) as typeof req.query;
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params) as typeof req.params;
  }
  next();
}
