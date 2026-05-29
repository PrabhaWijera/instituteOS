import { Request, Response } from 'express';
import { enrollmentService } from './enrollment.service';
import { asyncHandler } from '../../utils/asyncHandler';
import prisma from '../../config/prisma';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const result = await enrollmentService.create(req.body, req.user!.instituteId!);
  res.status(201).json({ success: true, data: result, message: 'Student enrolled successfully' });
});

export const findAll = asyncHandler(async (req: Request, res: Response) => {
  const filters = { classId: req.query.classId as string, status: req.query.status as string };
  const result = await enrollmentService.findAll(req.user!.instituteId!, filters);
  res.status(200).json({ success: true, data: result });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const result = await enrollmentService.remove(req.params.id, req.user!.instituteId!);
  res.status(200).json({ success: true, data: result, message: 'Student unenrolled' });
});

export const getByStudent = asyncHandler(async (req: Request, res: Response) => {
  // STUDENT role: resolve their own student record from JWT and verify it matches the requested ID
  if (req.user!.role === 'STUDENT') {
    const ownStudent = await prisma.student.findFirst({
      where: { userId: req.user!.userId, isDeleted: false },
      select: { id: true },
    });
    if (!ownStudent || ownStudent.id !== req.params.studentId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
  }

  const result = await enrollmentService.getByStudent(req.params.studentId);
  res.status(200).json({ success: true, data: result });
});
