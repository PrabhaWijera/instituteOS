import { Router } from 'express';
import * as dashboardController from './dashboard.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';

const router = Router();

router.get('/super-admin', authenticate, requireRole('SUPER_ADMIN'), dashboardController.getSuperAdminDashboard);
router.get('/analytics', authenticate, requireRole('SUPER_ADMIN'), dashboardController.getProductAnalytics);
router.get('/admin', authenticate, requireRole('INSTITUTE_ADMIN'), dashboardController.getAdminDashboard);
router.get('/teacher', authenticate, requireRole('TEACHER'), dashboardController.getTeacherDashboard);
router.get('/student', authenticate, requireRole('STUDENT'), dashboardController.getStudentDashboard);

export default router;
