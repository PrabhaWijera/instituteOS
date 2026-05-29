import { z } from 'zod';

export const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const inviteTeacherSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
});

export const usersQuerySchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']).optional(),
  instituteId: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type InviteTeacherInput = z.infer<typeof inviteTeacherSchema>;
export type UsersQuery = z.infer<typeof usersQuerySchema>;
