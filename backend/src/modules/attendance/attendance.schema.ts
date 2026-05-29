import { z } from 'zod';

export const startSessionSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
});

export const verifyOtpSchema = z.object({
  otpCode: z.string().length(6, 'OTP must be 6 digits'),
  classId: z.string().uuid('Invalid class ID'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const manualMarkSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  studentId: z.string().uuid('Invalid student ID'),
  status: z.enum(['PRESENT', 'ABSENT']),
  checkInTime: z.string().datetime().optional(),
  reason: z.string().optional(),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ManualMarkInput = z.infer<typeof manualMarkSchema>;
