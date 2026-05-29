import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { ApiError } from '../utils/ApiError';

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Unauthorized'));
    }
    if (!roles.includes(req.user.role as Role)) {
      return next(new ApiError(403, 'Forbidden — insufficient permissions'));
    }
    next();
  };
}
