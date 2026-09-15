import { prisma } from '@/lib/prisma';
import type { BookingEvent } from '@/services/notificationService';

// Per-user notification preferences (Phase 5.2). No row = all channels on
// (existing behavior preserved; opt-out is explicit). Events split into
// two categories: confirmations (confirmed/cancelled/rescheduled) and
// reminders (24h/1h).

export interface ResolvedPrefs {
  emailConfirmations: boolean;
  emailReminders: boolean;
  pushConfirmations: boolean;
  pushReminders: boolean;
}

export const DEFAULT_PREFS: ResolvedPrefs = {
  emailConfirmations: true,
  emailReminders: true,
  pushConfirmations: true,
  pushReminders: true,
};

export function eventCategory(event: BookingEvent): 'confirmations' | 'reminders' {
  return event === 'reminder_24h' || event === 'reminder_1h' ? 'reminders' : 'confirmations';
}

export async function getNotificationPrefs(userId: string): Promise<ResolvedPrefs> {
  const row = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (!row) return { ...DEFAULT_PREFS };
  return {
    emailConfirmations: row.emailConfirmations,
    emailReminders: row.emailReminders,
    pushConfirmations: row.pushConfirmations,
    pushReminders: row.pushReminders,
  };
}

export function channelAllowed(
  prefs: ResolvedPrefs,
  event: BookingEvent,
  channel: 'email' | 'push'
): boolean {
  const cat = eventCategory(event);
  return cat === 'reminders' ? prefs[`${channel}Reminders`] : prefs[`${channel}Confirmations`];
}
