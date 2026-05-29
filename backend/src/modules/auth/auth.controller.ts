import { Request, Response } from 'express';
import { authService } from './auth.service';
import { asyncHandler } from '../../utils/asyncHandler';
import cloudinary from '../../config/cloudinary';
import { Readable } from 'stream';

export const registerOwner = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.registerOwner(req.body);
  res.status(201).json({ success: true, data: result, message: 'Super admin registered successfully' });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);

  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });

  res.status(200).json({
    success: true,
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ success: false, message: 'Refresh token not found' });
    return;
  }

  const result = await authService.refreshAccessToken(refreshToken);
  res.status(200).json({ success: true, data: result });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken && req.user) {
    await authService.logout(req.user.userId, refreshToken);
  }

  res.clearCookie('refreshToken', { path: '/' });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

export const getInvite = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.getInvite(req.params.token);
  res.status(200).json({ success: true, data: result });
});

export const acceptInvite = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.acceptInvite(req.body);
  res.status(200).json({ success: true, data: result, message: 'Account activated successfully' });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.getMe(req.user!.userId);
  res.status(200).json({ success: true, data: result });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.updateProfile(req.user!.userId, req.body);
  res.status(200).json({ success: true, data: result });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.changePassword(req.user!.userId, req.body);
  res.status(200).json({ success: true, data: result });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.forgotPassword(req.body);
  res.status(200).json({ success: true, data: result });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.resetPassword(req.body);
  res.status(200).json({ success: true, data: result });
});

export const uploadProfileImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'No file uploaded' });
    return;
  }

  const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'nexclass/profiles',
        transformation: [{ width: 400, height: 400, crop: 'fill' }],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result as { secure_url: string });
      }
    );
    const readable = Readable.from(req.file!.buffer);
    readable.pipe(uploadStream);
  });

  const result = await authService.uploadProfileImage(req.user!.userId, uploadResult.secure_url);
  res.status(200).json({ success: true, data: result });
});
