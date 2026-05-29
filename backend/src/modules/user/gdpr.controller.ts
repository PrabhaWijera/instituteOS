import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { gdprService } from './gdpr.service';

/**
 * GET /api/v1/users/me/data-export
 * Right to Access (GDPR Art. 15 / CCPA).
 * Returns a JSON archive of all personal data held for the requesting user.
 */
export const exportMyData = asyncHandler(async (req: Request, res: Response) => {
  const data = await gdprService.exportUserData(req.user!.userId);

  res
    .status(200)
    .setHeader('Content-Disposition', `attachment; filename="nexclass-data-${req.user!.userId}.json"`)
    .json({ success: true, data });
});

/**
 * DELETE /api/v1/users/me
 * Right to Erasure (GDPR Art. 17 / CCPA "Right to Delete").
 * Anonymises the account and purges sensitive PII.
 */
export const deleteMyAccount = asyncHandler(async (req: Request, res: Response) => {
  const result = await gdprService.deleteUserData(req.user!.userId, req.user!.userId);
  res.status(200).json({ success: true, ...result });
});

/**
 * DELETE /api/v1/users/:id/data  (Super Admin only)
 * Admin-initiated erasure on behalf of a user.
 */
export const adminDeleteUserData = asyncHandler(async (req: Request, res: Response) => {
  const result = await gdprService.deleteUserData(req.params.id, req.user!.userId);
  res.status(200).json({ success: true, ...result });
});
