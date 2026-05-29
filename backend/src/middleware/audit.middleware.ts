import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Audit logging middleware for sensitive admin actions.
 * Logs who did what, when, and from where.
 */
export function auditLog(action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Capture original json to log after response
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown) {
      const statusCode = res.statusCode;
      const success = statusCode >= 200 && statusCode < 300;

      logger.info('AUDIT', {
        action,
        userId: req.user?.userId || 'anonymous',
        role: req.user?.role || 'unknown',
        instituteId: req.user?.instituteId || null,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        statusCode,
        success,
        timestamp: new Date().toISOString(),
      });

      return originalJson(body);
    };

    next();
  };
}
