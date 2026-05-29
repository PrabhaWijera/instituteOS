import { z } from 'zod';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export const createClassSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
  subject: z.string().min(1, 'Subject is required'),
  grade: z.string().min(1, 'Grade is required'),
  teacherId: z.string().uuid('Invalid teacher ID'),
  feeAmount: z.number().positive('Fee must be positive'),
  maxCapacity: z.number().int().positive().optional(),
  description: z.string().optional(),
  scheduleDays: z.array(z.enum(DAYS)).min(1, 'At least one schedule day is required'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:MM format'),
  durationMinutes: z.number().int().min(30).max(240),
});

export const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().optional(),
  grade: z.string().optional(),
  teacherId: z.string().uuid().optional(),
  feeAmount: z.number().positive().optional(),
  maxCapacity: z.number().int().positive().optional().nullable(),
  description: z.string().optional().nullable(),
  scheduleDays: z.array(z.enum(DAYS)).min(1).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  durationMinutes: z.number().int().min(30).max(240).optional(),
});

export const updateClassStatusSchema = z.object({
  isActive: z.boolean(),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
