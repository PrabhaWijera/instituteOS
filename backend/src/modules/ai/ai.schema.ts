import { z } from 'zod';

export const chatSchema = z.object({
  message: z.string().min(1).max(500, 'Message must be under 500 characters'),
  subject: z.string().min(1, 'Subject is required'),
  grade: z.string().min(1, 'Grade is required'),
  language: z.enum(['english', 'sinhala', 'bilingual']).default('english'),
});

export type ChatInput = z.infer<typeof chatSchema>;
