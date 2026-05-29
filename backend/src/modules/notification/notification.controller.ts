import { Request, Response } from 'express';
import { notificationService } from './notification.service';
import { asyncHandler } from '../../utils/asyncHandler';

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const result = await notificationService.getByUser(req.user!.userId);
  res.status(200).json({ success: true, data: result });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.markRead(req.params.id, req.user!.userId);
  res.status(200).json({ success: true, message: 'Notification marked as read' });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.markAllRead(req.user!.userId);
  res.status(200).json({ success: true, message: 'All notifications marked as read' });
});
