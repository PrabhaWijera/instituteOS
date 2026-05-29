import { Request, Response } from 'express';
import { aiService } from './ai.service';
import { asyncHandler } from '../../utils/asyncHandler';

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const result = await aiService.chat(req.user!.userId, req.body);
  res.status(200).json({ success: true, data: result });
});

export const getHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await aiService.getHistory(req.user!.userId);
  res.status(200).json({ success: true, data: result });
});

export const clearHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await aiService.clearHistory(req.user!.userId);
  res.status(200).json({ success: true, data: result });
});
