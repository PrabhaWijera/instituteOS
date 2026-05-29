import { Request, Response } from 'express';
import { studentService } from './student.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { parsePagination } from '../../utils/pagination';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await studentService.register(req.body, req.user!.instituteId!, req.user!.userId);
  res.status(201).json({ success: true, data: result, message: 'Student registered successfully' });
});

export const findAll = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as { page?: string; limit?: string });
  const filters = {
    verificationStatus: req.query.verificationStatus as string,
    grade: req.query.grade as string,
    search: req.query.search as string,
  };
  const result = await studentService.findAll(req.user!.instituteId!, pagination, filters);
  res.status(200).json({ success: true, ...result });
});

export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await studentService.findById(req.params.id, req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const result = await studentService.update(req.params.id, req.user!.instituteId!, req.body);
  res.status(200).json({ success: true, data: result });
});

export const verify = asyncHandler(async (req: Request, res: Response) => {
  const result = await studentService.verify(req.params.id, req.user!.instituteId!);
  res.status(200).json({ success: true, data: result, message: 'Student verified' });
});

export const toggleActive = asyncHandler(async (req: Request, res: Response) => {
  const result = await studentService.toggleActive(req.params.id, req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const deleteStudent = asyncHandler(async (req: Request, res: Response) => {
  const result = await studentService.deleteStudent(req.params.id, req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const getOwnProfile = asyncHandler(async (req: Request, res: Response) => {
  const result = await studentService.getOwnProfile(req.user!.userId);
  res.status(200).json({ success: true, data: result });
});

export const onboarding = asyncHandler(async (req: Request, res: Response) => {
  const result = await studentService.onboarding(req.user!.userId, req.body);
  res.status(200).json({ success: true, data: result });
});

export const submitProfile = asyncHandler(async (req: Request, res: Response) => {
  const result = await studentService.submitProfile(req.user!.userId);
  res.status(200).json({ success: true, data: result, message: 'Profile submitted for verification' });
});

export const getAcademic = asyncHandler(async (req: Request, res: Response) => {
  const result = await studentService.getAcademic(req.user!.userId);
  res.status(200).json({ success: true, data: result });
});
