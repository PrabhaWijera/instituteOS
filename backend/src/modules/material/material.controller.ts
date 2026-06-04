import { Request, Response } from 'express';
import { materialService } from './material.service';
import { asyncHandler } from '../../utils/asyncHandler';
import cloudinary from '../../config/cloudinary';
import { cloudinaryCircuit } from '../../config/resilience';
import { withRetry } from '../../utils/retry';
import { Readable } from 'stream';
import { ApiError } from '../../utils/ApiError';

/**
 * Wraps the Cloudinary upload_stream callback API in a Promise so it can be
 * composed with the circuit breaker and retry utility.
 */
function uploadToCloudinary(buffer: Buffer, mimetype: string): Promise<{ secure_url: string }> {
  return new Promise((resolve, reject) => {
    // PDF as image resource so browsers can embed/preview inline (raw forces download)
    const options =
      mimetype === 'application/pdf'
        ? { folder: 'nexclass/materials', resource_type: 'image' as const, format: 'pdf' as const }
        : { folder: 'nexclass/materials', resource_type: 'auto' as const };

    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result as { secure_url: string });
    });
    Readable.from(buffer).pipe(stream);
  });
}

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { classId } = req.params;
  let url = req.body.url;

  if (req.file) {
    // Circuit breaker + retry around the Cloudinary upload
    if (!cloudinaryCircuit.isAvailable()) {
      throw new ApiError(503, 'File upload service is temporarily unavailable. Please try again later or provide a URL instead.');
    }

    const uploadResult = await cloudinaryCircuit.execute(() =>
      withRetry(() => uploadToCloudinary(req.file!.buffer, req.file!.mimetype), {
        maxAttempts: 3,
        initialDelayMs: 500,
        operationName: 'cloudinary-upload',
      }),
    );
    url = uploadResult.secure_url;
  }

  if (!url) {
    res.status(400).json({ success: false, message: 'URL or file is required' });
    return;
  }

  const result = await materialService.create(classId, req.user!.userId, req.user!.role, {
    title: req.body.title,
    type: req.body.type,
    url,
  });
  res.status(201).json({ success: true, data: result, message: 'Material uploaded' });
});

export const getByClass = asyncHandler(async (req: Request, res: Response) => {
  const result = await materialService.getByClass(req.params.classId, req.user!.role, req.user!.userId);
  res.status(200).json({ success: true, data: result });
});

export const toggleVisibility = asyncHandler(async (req: Request, res: Response) => {
  const result = await materialService.toggleVisibility(req.params.id, req.user!.userId, req.user!.role);
  res.status(200).json({ success: true, data: result });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const result = await materialService.delete(req.params.id, req.user!.userId, req.user!.role);
  res.status(200).json({ success: true, data: result });
});
