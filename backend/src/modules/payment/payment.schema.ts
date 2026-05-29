import { z } from 'zod';

export const recordPaymentSchema = z.object({
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'ONLINE']),
  amount: z.number().positive().optional(),
  notes: z.string().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
