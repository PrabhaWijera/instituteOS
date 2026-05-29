import { Request, Response } from 'express';
import { attendanceService } from './attendance.service';
import { asyncHandler } from '../../utils/asyncHandler';

export const startSession = asyncHandler(async (req: Request, res: Response) => {
  const result = await attendanceService.startSession(req.body, req.user!.userId, req.user!.instituteId!);
  res.status(201).json({ success: true, data: result, message: 'Session started' });
});

export const getSessions = asyncHandler(async (req: Request, res: Response) => {
  const teacherId = req.user!.role === 'TEACHER' ? req.user!.userId : undefined;
  const classId = req.query.classId as string | undefined;
  const result = await attendanceService.getSessions(req.user!.instituteId!, teacherId, classId);
  res.status(200).json({ success: true, data: result });
});

export const getSessionById = asyncHandler(async (req: Request, res: Response) => {
  const result = await attendanceService.getSessionById(req.params.id, req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const endSession = asyncHandler(async (req: Request, res: Response) => {
  const result = await attendanceService.endSession(req.params.id, req.user!.userId);
  res.status(200).json({ success: true, data: result, message: 'Session ended' });
});

export const getSessionReport = asyncHandler(async (req: Request, res: Response) => {
  const result = await attendanceService.getSessionReport(req.params.id, req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await attendanceService.verifyOtp(req.user!.userId, req.body);
  res.status(200).json({ success: true, data: result, message: 'Attendance marked successfully' });
});

export const manualMark = asyncHandler(async (req: Request, res: Response) => {
  const result = await attendanceService.manualMark(req.body, req.user!.userId);
  res.status(200).json({ success: true, data: result });
});

export const getStudentHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await attendanceService.getStudentHistory(req.user!.userId);
  res.status(200).json({ success: true, data: result });
});

export const getClassHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await attendanceService.getClassHistory(req.params.classId, req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});
