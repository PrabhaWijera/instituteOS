import { Router } from 'express';
import * as studentController from './student.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { registerStudentSchema, updateStudentSchema, studentOnboardingSchema } from './student.schema';

const router = Router();

// Admin routes
router.post('/', authenticate, requireRole('INSTITUTE_ADMIN'), validate(registerStudentSchema), studentController.register);
router.get('/', authenticate, requireRole('INSTITUTE_ADMIN'), studentController.findAll);
router.get('/me', authenticate, requireRole('STUDENT'), studentController.getOwnProfile);
router.patch('/me/onboarding', authenticate, requireRole('STUDENT'), validate(studentOnboardingSchema), studentController.onboarding);
router.post('/me/submit', authenticate, requireRole('STUDENT'), studentController.submitProfile);
router.get('/me/academic', authenticate, requireRole('STUDENT'), studentController.getAcademic);
router.get('/:id', authenticate, requireRole('INSTITUTE_ADMIN'), studentController.findById);
router.patch('/:id', authenticate, requireRole('INSTITUTE_ADMIN'), validate(updateStudentSchema), studentController.update);
router.patch('/:id/verify', authenticate, requireRole('INSTITUTE_ADMIN'), studentController.verify);
router.patch('/:id/status', authenticate, requireRole('INSTITUTE_ADMIN'), studentController.toggleActive);
router.delete('/:id', authenticate, requireRole('INSTITUTE_ADMIN'), studentController.deleteStudent);

export default router;
