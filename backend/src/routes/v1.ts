import { Router } from 'express';

import authRoutes from '../modules/auth/auth.routes';
import instituteRoutes from '../modules/institute/institute.routes';
import userRoutes from '../modules/user/user.routes';
import classRoutes from '../modules/class/class.routes';
import studentRoutes from '../modules/student/student.routes';
import enrollmentRoutes from '../modules/enrollment/enrollment.routes';
import attendanceRoutes from '../modules/attendance/attendance.routes';
import paymentRoutes from '../modules/payment/payment.routes';
import materialRoutes from '../modules/material/material.routes';
import aiRoutes from '../modules/ai/ai.routes';
import notificationRoutes from '../modules/notification/notification.routes';
import dashboardRoutes from '../modules/dashboard/dashboard.routes';
import parentRoutes from '../modules/parent/parent.routes';

const v1Router = Router();

v1Router.use('/auth', authRoutes);
v1Router.use('/institutes', instituteRoutes);
v1Router.use('/users', userRoutes);
v1Router.use('/classes', classRoutes);
v1Router.use('/students', studentRoutes);
v1Router.use('/enrollments', enrollmentRoutes);
v1Router.use('/attendance', attendanceRoutes);
v1Router.use('/payments', paymentRoutes);
v1Router.use('/materials', materialRoutes);
v1Router.use('/ai', aiRoutes);
v1Router.use('/notifications', notificationRoutes);
v1Router.use('/dashboard', dashboardRoutes);
v1Router.use('/parent', parentRoutes);

export default v1Router;
