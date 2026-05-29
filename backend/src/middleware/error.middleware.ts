import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // Structured error context
  const errorContext = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.userId,
  };

  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { ...errorContext, stack: err.stack });
    } else {
      logger.warn(err.message, errorContext);
    }
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
    return;
  }

  // Prisma known errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as { code?: string; meta?: { target?: string[] } };
    if (prismaErr.code === 'P2002') {
      logger.warn('Unique constraint violation', { ...errorContext, target: prismaErr.meta?.target });
      res.status(409).json({
        success: false,
        message: `Unique constraint violation on: ${prismaErr.meta?.target?.join(', ')}`,
      });
      return;
    }
    if (prismaErr.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Record not found',
      });
      return;
    }
  }

  // Report to Sentry
  Sentry.captureException(err, { extra: errorContext });

  logger.error('Unhandled error', { ...errorContext, error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}
