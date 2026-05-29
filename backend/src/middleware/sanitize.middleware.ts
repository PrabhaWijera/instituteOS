import { Request, Response, NextFunction } from 'express';

/**
 * Recursively sanitize strings in an object to prevent XSS.
 * Strips HTML tags and dangerous characters from user input.
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    sanitized[key] = sanitizeValue(val);
  }
  return sanitized;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params.
 * Skips sanitization for specific content types (e.g., file uploads).
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  // Skip file uploads
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
