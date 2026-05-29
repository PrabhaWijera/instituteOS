import { Router } from 'express';
import * as attendanceController from './attendance.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { startSessionSchema, verifyOtpSchema, manualMarkSchema } from './attendance.schema';

const router = Router();

// Only teachers can start and end sessions
router.post('/sessions', authenticate, requireRole('TEACHER'), validate(startSessionSchema), attendanceController.startSession);
router.patch('/sessions/:id/end', authenticate, requireRole('TEACHER'), attendanceController.endSession);

// Both teacher and admin can view sessions and reports
router.get('/sessions', authenticate, requireRole('TEACHER', 'INSTITUTE_ADMIN'), attendanceController.getSessions);
router.get('/sessions/:id', authenticate, requireRole('TEACHER', 'INSTITUTE_ADMIN'), attendanceController.getSessionById);
router.get('/sessions/:id/report', authenticate, requireRole('TEACHER', 'INSTITUTE_ADMIN'), attendanceController.getSessionReport);

// Student OTP verify
router.post('/verify-otp', authenticate, requireRole('STUDENT'), validate(verifyOtpSchema), attendanceController.verifyOtp);

// Manual mark: teacher only (admin should not bypass OTP system)
router.post('/manual', authenticate, requireRole('TEACHER'), validate(manualMarkSchema), attendanceController.manualMark);
router.get('/history/me', authenticate, requireRole('STUDENT'), attendanceController.getStudentHistory);
router.get('/history/class/:classId', authenticate, requireRole('TEACHER', 'INSTITUTE_ADMIN'), attendanceController.getClassHistory);

export default router;
