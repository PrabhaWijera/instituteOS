import { Request, Response } from 'express';
import { parentService } from './parent.service';
import { asyncHandler } from '../../utils/asyncHandler';

export const getChildren = asyncHandler(async (req: Request, res: Response) => {
  const result = await parentService.getChildren(req.user!.userId);
  res.status(200).json({ success: true, data: result });
});

export const getChildDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await parentService.getChildDetail(req.user!.userId, req.params.studentId);
  res.status(200).json({ success: true, data: result });
});

export const getChildPayments = asyncHandler(async (req: Request, res: Response) => {
  const result = await parentService.getChildPayments(req.user!.userId, req.params.studentId);
  res.status(200).json({ success: true, data: result });
});

export const getChildAttendance = asyncHandler(async (req: Request, res: Response) => {
  const result = await parentService.getChildAttendance(req.user!.userId, req.params.studentId);
  res.status(200).json({ success: true, data: result });
});

export const getChildMaterials = asyncHandler(async (req: Request, res: Response) => {
  const result = await parentService.getChildMaterials(req.user!.userId, req.params.studentId);
  res.status(200).json({ success: true, data: result });
});
