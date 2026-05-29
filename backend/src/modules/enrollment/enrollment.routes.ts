import { Router } from 'express';
import * as enrollmentController from './enrollment.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createEnrollmentSchema } from './enrollment.schema';

const router = Router();

router.post('/', authenticate, requireRole('INSTITUTE_ADMIN'), validate(createEnrollmentSchema), enrollmentController.create);
router.get('/', authenticate, requireRole('INSTITUTE_ADMIN'), enrollmentController.findAll);
router.delete('/:id', authenticate, requireRole('INSTITUTE_ADMIN'), enrollmentController.remove);
router.get('/student/:studentId', authenticate, requireRole('INSTITUTE_ADMIN', 'STUDENT'), enrollmentController.getByStudent);

export default router;
