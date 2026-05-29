import { Router } from 'express';
import * as paymentController from './payment.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { recordPaymentSchema } from './payment.schema';
import { auditLog } from '../../middleware/audit.middleware';

const router = Router();

router.get('/me', authenticate, requireRole('STUDENT'), paymentController.getMyDues);
router.patch('/:id/ready', authenticate, requireRole('STUDENT'), paymentController.signalReady);
router.get('/', authenticate, requireRole('INSTITUTE_ADMIN'), paymentController.getAllDues);
router.get('/class/:classId', authenticate, requireRole('TEACHER', 'INSTITUTE_ADMIN'), paymentController.getClassDues);
router.post('/:id/record', authenticate, requireRole('INSTITUTE_ADMIN', 'TEACHER'), validate(recordPaymentSchema), auditLog('payment.record'), paymentController.recordPayment);
router.get('/reports/institute', authenticate, requireRole('INSTITUTE_ADMIN'), paymentController.getInstituteReport);
router.get('/status/:studentId/:classId', authenticate, requireRole('INSTITUTE_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), paymentController.getPaymentStatus);

export default router;
