import { z } from 'zod';

export const createMaterialSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['PDF', 'VIDEO_LINK', 'LIVE_LINK']),
  url: z.string().url().optional().or(z.literal('')),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
