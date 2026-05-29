import { z } from 'zod';

export const registerStudentSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email'),
  grade: z.string().min(1, 'Grade is required'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dob: z.string().datetime().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  parentName: z.string().optional(),
  parentEmail: z.string().email().optional().or(z.literal('')),
  parentPhone: z.string().optional(),
  classId: z.string().uuid().optional(),
});

export const updateStudentSchema = z.object({
  grade: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dob: z.string().datetime().optional(),
  address: z.string().optional(),
  parentName: z.string().optional(),
  parentEmail: z.string().email().optional().or(z.literal('')),
  parentPhone: z.string().optional(),
});

export const studentOnboardingSchema = z.object({
  dob: z.string().datetime().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: z.string().optional(),
  parentName: z.string().optional(),
  parentEmail: z.string().email().optional().or(z.literal('')),
  parentPhone: z.string().optional(),
});

export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type StudentOnboardingInput = z.infer<typeof studentOnboardingSchema>;
