import { z } from 'zod';

export const createEnrollmentSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  classId: z.string().uuid('Invalid class ID'),
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
