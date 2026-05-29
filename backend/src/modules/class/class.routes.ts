import { Router } from 'express';
import * as classController from './class.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createClassSchema, updateClassSchema, updateClassStatusSchema } from './class.schema';

const router = Router();

router.post('/', authenticate, requireRole('INSTITUTE_ADMIN'), validate(createClassSchema), classController.create);
router.get('/', authenticate, requireRole('INSTITUTE_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), classController.findAll);
router.get('/my', authenticate, requireRole('TEACHER'), classController.getMyClasses);
router.get('/:id', authenticate, requireRole('INSTITUTE_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), classController.findById);
router.patch('/:id', authenticate, requireRole('INSTITUTE_ADMIN'), validate(updateClassSchema), classController.update);
router.patch('/:id/status', authenticate, requireRole('INSTITUTE_ADMIN'), validate(updateClassStatusSchema), classController.updateStatus);
router.delete('/:id', authenticate, requireRole('INSTITUTE_ADMIN'), classController.remove);

export default router;
