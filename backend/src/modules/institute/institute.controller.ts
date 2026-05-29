import { Request, Response } from 'express';
import { instituteService } from './institute.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { parsePagination } from '../../utils/pagination';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const result = await instituteService.create(req.body, req.user!.userId);
  res.status(201).json({ success: true, data: result, message: 'Institute created successfully' });
});

export const findAll = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as { page?: string; limit?: string });
  const search = req.query.search as string | undefined;
  const result = await instituteService.findAll(pagination, search);
  res.status(200).json({ success: true, ...result });
});

export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await instituteService.findById(req.params.id);
  res.status(200).json({ success: true, data: result });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const result = await instituteService.update(req.params.id, req.body);
  res.status(200).json({ success: true, data: result });
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await instituteService.updateStatus(req.params.id, req.body.isActive);
  res.status(200).json({ success: true, data: result });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const result = await instituteService.delete(req.params.id);
  res.status(200).json({ success: true, data: result });
});

export const getOwnInstitute = asyncHandler(async (req: Request, res: Response) => {
  const result = await instituteService.getOwnInstitute(req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const updateOwnInstitute = asyncHandler(async (req: Request, res: Response) => {
  const result = await instituteService.updateOwnInstitute(req.user!.instituteId!, req.body);
  res.status(200).json({ success: true, data: result });
});

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const result = await instituteService.getSettings(req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const result = await instituteService.updateSettings(req.user!.instituteId!, req.body);
  res.status(200).json({ success: true, data: result });
});
