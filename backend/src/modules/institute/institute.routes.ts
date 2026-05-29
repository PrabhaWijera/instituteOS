import { Router } from 'express';
import * as instituteController from './institute.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createInstituteSchema,
  updateInstituteSchema,
  updateInstituteStatusSchema,
  updateInstituteSettingsSchema,
} from './institute.schema';
import { auditLog } from '../../middleware/audit.middleware';

const router = Router();

// Super admin routes
router.post('/', authenticate, requireRole('SUPER_ADMIN'), validate(createInstituteSchema), auditLog('institute.create'), instituteController.create);
router.get('/', authenticate, requireRole('SUPER_ADMIN'), instituteController.findAll);
router.get('/me', authenticate, requireRole('INSTITUTE_ADMIN'), instituteController.getOwnInstitute);
router.patch('/me', authenticate, requireRole('INSTITUTE_ADMIN'), validate(updateInstituteSchema), instituteController.updateOwnInstitute);
router.get('/me/settings', authenticate, requireRole('INSTITUTE_ADMIN'), instituteController.getSettings);
router.patch('/me/settings', authenticate, requireRole('INSTITUTE_ADMIN'), validate(updateInstituteSettingsSchema), instituteController.updateSettings);
router.get('/:id', authenticate, requireRole('SUPER_ADMIN'), instituteController.findById);
router.patch('/:id', authenticate, requireRole('SUPER_ADMIN'), validate(updateInstituteSchema), auditLog('institute.update'), instituteController.update);
router.patch('/:id/status', authenticate, requireRole('SUPER_ADMIN'), validate(updateInstituteStatusSchema), auditLog('institute.status_change'), instituteController.updateStatus);
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN'), auditLog('institute.delete'), instituteController.remove);

export default router;
