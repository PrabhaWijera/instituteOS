import { Router } from 'express';
import * as userController from './user.controller';
import * as gdprController from './gdpr.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { updateUserSchema, updateUserStatusSchema, inviteTeacherSchema } from './user.schema';
import { auditLog } from '../../middleware/audit.middleware';
import { sensitiveUserLimiter } from '../../middleware/rateLimit.middleware';

const router = Router();

// Super admin routes
router.get('/', authenticate, requireRole('SUPER_ADMIN'), userController.findAll);
router.get('/faculty', authenticate, requireRole('INSTITUTE_ADMIN'), userController.getFaculty);
router.post('/faculty/invite', authenticate, requireRole('INSTITUTE_ADMIN'), validate(inviteTeacherSchema), userController.inviteTeacher);
router.get('/faculty/:id', authenticate, requireRole('INSTITUTE_ADMIN'), userController.getFacultyById);
router.patch('/faculty/:id', authenticate, requireRole('INSTITUTE_ADMIN'), userController.updateFaculty);
router.patch('/faculty/:id/status', authenticate, requireRole('INSTITUTE_ADMIN'), userController.toggleFacultyStatus);
router.delete('/faculty/:id', authenticate, requireRole('INSTITUTE_ADMIN'), auditLog('faculty.delete'), userController.deleteFaculty);
router.get('/invites', authenticate, requireRole('INSTITUTE_ADMIN'), userController.getInvites);
router.delete('/invites/:id', authenticate, requireRole('INSTITUTE_ADMIN'), userController.deleteInvite);
router.get('/:id', authenticate, requireRole('SUPER_ADMIN'), userController.findById);
router.patch('/:id', authenticate, requireRole('SUPER_ADMIN'), validate(updateUserSchema), userController.update);
router.patch('/:id/status', authenticate, requireRole('SUPER_ADMIN'), validate(updateUserStatusSchema), userController.updateStatus);
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN'), userController.deleteUser);
router.post('/:id/resend-invite', authenticate, requireRole('SUPER_ADMIN', 'INSTITUTE_ADMIN'), userController.resendInvite);

// Session management
router.get('/:id/sessions', authenticate, requireRole('SUPER_ADMIN', 'INSTITUTE_ADMIN'), userController.getUserSessions);
router.delete('/:id/sessions', authenticate, requireRole('SUPER_ADMIN', 'INSTITUTE_ADMIN'), auditLog('session.revoke_all'), userController.revokeUserSessions);
router.delete('/sessions/:sessionId', authenticate, requireRole('SUPER_ADMIN', 'INSTITUTE_ADMIN'), auditLog('session.revoke'), userController.revokeSession);

// ---------------------------------------------------------------------------
// GDPR / Privacy compliance routes
// ---------------------------------------------------------------------------

// Right to Access — any authenticated user can export their own data
router.get('/me/data-export', authenticate, sensitiveUserLimiter, auditLog('gdpr.data_export'), gdprController.exportMyData);

// Right to Erasure — any authenticated user can delete their own account
router.delete('/me', authenticate, sensitiveUserLimiter, auditLog('gdpr.account_deletion'), gdprController.deleteMyAccount);

// Admin-initiated erasure (Super Admin only)
router.delete('/:id/data', authenticate, requireRole('SUPER_ADMIN'), auditLog('gdpr.admin_erasure'), gdprController.adminDeleteUserData);

export default router;
