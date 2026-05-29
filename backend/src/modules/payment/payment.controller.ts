import { Request, Response } from 'express';
import { paymentService } from './payment.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { parsePagination } from '../../utils/pagination';
import prisma from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';

export const getMyDues = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.getStudentDues(req.user!.userId);
  res.status(200).json({ success: true, data: result });
});

export const signalReady = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.signalReady(req.params.id, req.user!.userId);
  res.status(200).json({ success: true, data: result, message: 'Ready signal sent' });
});

export const getAllDues = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as { page?: string; limit?: string });
  const filters = { classId: req.query.classId as string, status: req.query.status as string };
  const result = await paymentService.getAllDues(req.user!.instituteId!, pagination, filters);
  res.status(200).json({ success: true, ...result });
});

export const getClassDues = asyncHandler(async (req: Request, res: Response) => {
  // Teacher can only see dues for classes assigned to them
  if (req.user!.role === 'TEACHER') {
    const cls = await prisma.tuitionClass.findFirst({
      where: { id: req.params.classId, teacherId: req.user!.userId, isDeleted: false },
      select: { id: true },
    });
    if (!cls) throw new ApiError(403, 'Forbidden');
  }
  const result = await paymentService.getClassDues(req.params.classId);
  res.status(200).json({ success: true, data: result });
});

export const recordPayment = asyncHandler(async (req: Request, res: Response) => {
  // Teacher can only record payment for classes assigned to them
  if (req.user!.role === 'TEACHER') {
    const payment = await prisma.paymentDue.findUnique({
      where: { id: req.params.id },
      include: { enrollment: { select: { classId: true } } },
    });
    if (!payment) throw new ApiError(404, 'Payment not found');
    const cls = await prisma.tuitionClass.findFirst({
      where: { id: payment.enrollment.classId, teacherId: req.user!.userId, isDeleted: false },
      select: { id: true },
    });
    if (!cls) throw new ApiError(403, 'Forbidden');
  }
  const result = await paymentService.recordPayment(req.params.id, req.body, req.user!.userId);
  res.status(200).json({ success: true, data: result, message: 'Payment recorded' });
});

export const getInstituteReport = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.getInstituteReport(req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const getPaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { studentId, classId } = req.params;
  const role = req.user!.role;
  const callerId = req.user!.userId;

  if (role === 'STUDENT') {
    const own = await prisma.student.findFirst({ where: { userId: callerId, isDeleted: false }, select: { id: true } });
    if (!own || own.id !== studentId) throw new ApiError(403, 'Forbidden');
  } else if (role === 'PARENT') {
    const link = await prisma.parentStudentLink.findFirst({ where: { parentId: callerId, studentId } });
    if (!link) throw new ApiError(403, 'Forbidden');
  } else if (role === 'TEACHER') {
    const cls = await prisma.tuitionClass.findFirst({ where: { id: classId, teacherId: callerId, isDeleted: false } });
    if (!cls) throw new ApiError(403, 'Forbidden');
  }
  // INSTITUTE_ADMIN passes through freely

  const result = await paymentService.getPaymentStatus(studentId, classId);
  res.status(200).json({ success: true, data: result });
});
