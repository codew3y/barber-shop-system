import { z } from 'zod';

export const scheduleQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').optional(),
  shopId: z.string().uuid().optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['confirmed', 'completed', 'no_show', 'cancelled']),
});

export const createTimeOffSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().max(500).optional(),
  shopId: z.string().uuid().optional(),
});

export const reviewTimeOffSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export const earningsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shopId: z.string().uuid().optional(),
});

export const upsertServiceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  durationMinutes: z.number().int().positive(),
  price: z.number().nonnegative(),
  bufferMinutes: z.number().int().min(0).default(5),
  category: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
  shopId: z.string().uuid().optional(),
});

export const updateStaffSchema = z.object({
  bio: z.string().max(2000).nullable().optional(),
  title: z.string().max(100).nullable().optional(),
  specialties: z.array(z.string().max(100)).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const analyticsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shopId: z.string().uuid().optional(),
});
