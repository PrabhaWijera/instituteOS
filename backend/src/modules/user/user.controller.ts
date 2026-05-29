import { Request, Response } from 'express';
import { userService } from './user.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { usersQuerySchema } from './user.schema';

export const findAll = asyncHandler(async (req: Request, res: Response) => {
  const query = usersQuerySchema.parse(req.query);
  const result = await userService.findAll(query);
  res.status(200).json({ success: true, data: result });
});

export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.findById(req.params.id);
  res.status(200).json({ success: true, data: result });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.update(req.params.id, req.body);
  res.status(200).json({ success: true, data: result });
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.updateStatus(req.params.id, req.body.isActive);
  res.status(200).json({ success: true, data: result });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.deleteUser(req.params.id);
  res.status(200).json({ success: true, data: result });
});

export const resendInvite = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.resendInvite(req.params.id, req.user!.userId);
  res.status(200).json({ success: true, data: result });
});

export const getFaculty = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.getFaculty(req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const inviteTeacher = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.inviteTeacher(req.body, req.user!.instituteId!, req.user!.userId);
  res.status(201).json({ success: true, data: result, message: 'Teacher invited successfully' });
});

export const getFacultyById = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.getFacultyById(req.params.id, req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const updateFaculty = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.updateFaculty(req.params.id, req.user!.instituteId!, req.body);
  res.status(200).json({ success: true, data: result });
});

export const toggleFacultyStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.toggleFacultyStatus(req.params.id, req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const deleteFaculty = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.deleteFaculty(req.params.id, req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const getInvites = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.getInvites(req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const deleteInvite = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.deleteInvite(req.params.id, req.user!.instituteId!);
  res.status(200).json({ success: true, data: result });
});

export const getUserSessions = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.getUserSessions(req.params.id);
  res.status(200).json({ success: true, data: result });
});

export const revokeUserSessions = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.revokeUserSessions(req.params.id);
  res.status(200).json({ success: true, data: result, message: 'All sessions revoked' });
});

export const revokeSession = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.revokeSession(req.params.sessionId);
  res.status(200).json({ success: true, data: result, message: 'Session revoked' });
});
