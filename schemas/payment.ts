import { z } from 'zod';

export const createIntentSchema = z.object({
  bookingId: z.string().uuid(),
  type: z.enum(['deposit', 'full']).default('deposit'),
});

export const refundSchema = z.object({
  amount: z.number().positive().optional(),
});
