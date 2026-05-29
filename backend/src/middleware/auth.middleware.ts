import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import prisma from '../config/prisma';
import redis from '../config/redis';

// Cache institute status for 30s to avoid a DB hit on every request.
// Key: `inst_status:<instituteId>` → "active" | "inactive" | "deleted"
async function getInstituteStatus(instituteId: string): Promise<'active' | 'inactive' | 'deleted'> {
  const cacheKey = `inst_status:${instituteId}`;
  try {
    const cached = await redis.get(cacheKey) as string | null;
    if (cached) return cached as 'active' | 'inactive' | 'deleted';
  } catch { /* redis unavailable — fall through to DB */ }

  const inst = await prisma.institute.findUnique({
    where: { id: instituteId },
    select: { isActive: true, isDeleted: true },
  });

  const status: 'active' | 'inactive' | 'deleted' =
    !inst || inst.isDeleted ? 'deleted' : !inst.isActive ? 'inactive' : 'active';

  try {
    await redis.set(cacheKey, status, { ex: 30 });
  } catch { /* ignore */ }

  return status;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Access token is required'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;

    // If the token belongs to an institute user, block access when institute is inactive/deleted
    if (payload.instituteId) {
      const status = await getInstituteStatus(payload.instituteId);
      if (status === 'deleted') {
        return next(new ApiError(403, 'Your institute no longer exists. Contact the platform administrator.'));
      }
      if (status === 'inactive') {
        return next(new ApiError(403, 'Your institute has been deactivated. Contact the platform administrator.'));
      }
    }

    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    return next(new ApiError(401, 'Invalid or expired access token'));
  }
}
