import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// Dangerous file signatures (magic bytes)
const DANGEROUS_SIGNATURES: { name: string; bytes: number[] }[] = [
  { name: 'EXE/DLL', bytes: [0x4D, 0x5A] },                    // MZ header
  { name: 'ELF', bytes: [0x7F, 0x45, 0x4C, 0x46] },            // ELF binary
  { name: 'Java Class', bytes: [0xCA, 0xFE, 0xBA, 0xBE] },     // Java .class
  { name: 'Shell Script', bytes: [0x23, 0x21] },                 // #! shebang
  { name: 'PHP', bytes: [0x3C, 0x3F, 0x70, 0x68, 0x70] },      // <?php
];

// Allowed MIME types per upload context
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOCUMENT_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

// Max file sizes by type
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;      // 5MB
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024;   // 25MB

function hasDangerousSignature(buffer: Buffer): string | null {
  for (const sig of DANGEROUS_SIGNATURES) {
    if (buffer.length >= sig.bytes.length) {
      const matches = sig.bytes.every((byte, i) => buffer[i] === byte);
      if (matches) return sig.name;
    }
  }
  return null;
}

function hasDoubleExtension(filename: string): boolean {
  const parts = filename.split('.');
  if (parts.length <= 2) return false;
  const dangerousExts = ['exe', 'bat', 'cmd', 'sh', 'php', 'jsp', 'py', 'rb', 'pl', 'cgi'];
  return parts.slice(0, -1).some(part => dangerousExts.includes(part.toLowerCase()));
}

/**
 * Validates uploaded image files (profile photos, etc.)
 */
export function validateImageUpload(req: Request, _res: Response, next: NextFunction) {
  if (!req.file) return next();

  const { file } = req;

  // Check MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw new ApiError(400, `File type ${file.mimetype} is not allowed. Allowed: JPEG, PNG, WebP, GIF`);
  }

  // Check size
  if (file.size > MAX_IMAGE_SIZE) {
    throw new ApiError(400, `File too large. Maximum size is ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
  }

  // Check magic bytes
  if (file.buffer) {
    const dangerous = hasDangerousSignature(file.buffer);
    if (dangerous) {
      logger.warn('Malicious file upload blocked', {
        type: dangerous,
        originalName: file.originalname,
        mimetype: file.mimetype,
        ip: req.ip,
        userId: req.user?.userId,
      });
      throw new ApiError(400, 'File appears to be malicious and has been rejected');
    }
  }

  // Check double extension
  if (hasDoubleExtension(file.originalname)) {
    logger.warn('Double extension file upload blocked', {
      originalName: file.originalname,
      ip: req.ip,
      userId: req.user?.userId,
    });
    throw new ApiError(400, 'File name contains suspicious extensions');
  }

  next();
}

/**
 * Validates uploaded document files (materials, etc.)
 */
export function validateDocumentUpload(req: Request, _res: Response, next: NextFunction) {
  if (!req.file) return next();

  const { file } = req;

  // Check MIME type
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
    throw new ApiError(400, `File type ${file.mimetype} is not allowed`);
  }

  // Check size
  if (file.size > MAX_DOCUMENT_SIZE) {
    throw new ApiError(400, `File too large. Maximum size is ${MAX_DOCUMENT_SIZE / (1024 * 1024)}MB`);
  }

  // Check magic bytes
  if (file.buffer) {
    const dangerous = hasDangerousSignature(file.buffer);
    if (dangerous) {
      logger.warn('Malicious document upload blocked', {
        type: dangerous,
        originalName: file.originalname,
        mimetype: file.mimetype,
        ip: req.ip,
        userId: req.user?.userId,
      });
      throw new ApiError(400, 'File appears to be malicious and has been rejected');
    }
  }

  // Check double extension
  if (hasDoubleExtension(file.originalname)) {
    logger.warn('Double extension document upload blocked', {
      originalName: file.originalname,
      ip: req.ip,
      userId: req.user?.userId,
    });
    throw new ApiError(400, 'File name contains suspicious extensions');
  }

  next();
}
