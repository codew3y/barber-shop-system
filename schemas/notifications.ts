import { z } from 'zod';

export const upsertPushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
  userAgent: z.string().max(500).optional(),
});

export const deletePushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
});

export const updateNotificationPrefsSchema = z.object({
  emailConfirmations: z.boolean(),
  emailReminders: z.boolean(),
  pushConfirmations: z.boolean(),
  pushReminders: z.boolean(),
});
