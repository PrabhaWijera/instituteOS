import { Router } from 'express';
import * as parentController from './parent.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';

const router = Router();

router.get('/children', authenticate, requireRole('PARENT'), parentController.getChildren);
router.get('/children/:studentId', authenticate, requireRole('PARENT'), parentController.getChildDetail);
router.get('/children/:studentId/payments', authenticate, requireRole('PARENT'), parentController.getChildPayments);
router.get('/children/:studentId/attendance', authenticate, requireRole('PARENT'), parentController.getChildAttendance);
router.get('/children/:studentId/materials', authenticate, requireRole('PARENT'), parentController.getChildMaterials);

export default router;
