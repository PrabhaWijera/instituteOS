import { Request, Response } from 'express';
import { dashboardService } from './dashboard.service';
import { asyncHandler } from '../../utils/asyncHandler';

export const getSuperAdminDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const result = await dashboardService.getSuperAdminDashboard();
  res.status(200).json({ success: true, data: result });
});

export const getAdminDashboard = asyncHandler(async (req: Request, res: Response) => {
  const result = await dashboardService.getAdminDashboard(req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const getTeacherDashboard = asyncHandler(async (req: Request, res: Response) => {
  const result = await dashboardService.getTeacherDashboard(req.user!.userId);
  res.status(200).json({ success: true, data: result });
});

export const getStudentDashboard = asyncHandler(async (req: Request, res: Response) => {
  const result = await dashboardService.getStudentDashboard(req.user!.userId);
  res.status(200).json({ success: true, data: result });
});

export const getProductAnalytics = asyncHandler(async (_req: Request, res: Response) => {
  const result = await dashboardService.getProductAnalytics();
  res.status(200).json({ success: true, data: result });
});
