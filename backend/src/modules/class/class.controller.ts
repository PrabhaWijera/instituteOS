import { Request, Response } from 'express';
import { classService } from './class.service';
import { asyncHandler } from '../../utils/asyncHandler';
import prisma from '../../config/prisma';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const result = await classService.create(req.body, req.user!.instituteId!);
  res.status(201).json({ success: true, data: result, message: 'Class created successfully' });
});

export const findAll = asyncHandler(async (req: Request, res: Response) => {
  const { role, userId, instituteId } = req.user!;

  if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!student) return res.status(200).json({ success: true, data: [] });
    const result = await classService.findForStudent(student.id, instituteId!);
    return res.status(200).json({ success: true, data: result });
  }

  if (role === 'PARENT') {
    const result = await classService.findForParent(userId, instituteId!);
    return res.status(200).json({ success: true, data: result });
  }

  const teacherId = role === 'TEACHER' ? userId : undefined;
  const result = await classService.findAll(instituteId!, teacherId);
  res.status(200).json({ success: true, data: result });
});

export const findById = asyncHandler(async (req: Request, res: Response) => {
  const { role, userId, instituteId } = req.user!;

  if (role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return res.status(403).json({ success: false, message: 'Access denied' });
    const enrolled = await prisma.studentEnrollment.findFirst({
      where: { studentId: student.id, classId: req.params.id, subscriptionStatus: { not: 'CANCELLED' } },
    });
    if (!enrolled) return res.status(403).json({ success: false, message: 'You are not enrolled in this class' });
  }

  const result = await classService.findById(req.params.id, instituteId!, role, userId);
  res.status(200).json({ success: true, data: result });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const result = await classService.update(req.params.id, req.user!.instituteId!, req.body);
  res.status(200).json({ success: true, data: result });
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await classService.updateStatus(req.params.id, req.user!.instituteId!, req.body.isActive);
  res.status(200).json({ success: true, data: result });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const result = await classService.softDelete(req.params.id, req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const getMyClasses = asyncHandler(async (req: Request, res: Response) => {
  const result = await classService.getTeacherClasses(req.user!.userId);
  res.status(200).json({ success: true, data: result });
});
