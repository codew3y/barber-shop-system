import { z } from 'zod';

export const createBookingSchema = z.object({
  shopId: z.string().uuid(),
  staffId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startTime: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const rescheduleBookingSchema = z.object({
  newStartTime: z.string().datetime(),
});

// A regex alone accepts impossible dates like 2026-13-45, which JS Date
// silently rolls over into another month — so the API answered for a date the
// caller never requested. Round-trip the parse to reject those.
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Not a real calendar date');

export const availabilityQuerySchema = z.object({
  date: calendarDate,
  serviceId: z.string().uuid(),
});

export const shopListQuerySchema = z.object({
  city: z.string().optional(),
  state: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const myBookingsQuerySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
