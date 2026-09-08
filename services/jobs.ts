import { prisma } from '@/lib/prisma';
import { queueBookingNotifications, type BookingEvent } from './notificationService';

export interface JobSummary {
  holdsReleased: number;
  remindersSent: number;
  noShowsMarked: number;
  at: string;
}

// Release abandoned payment holds so slots free up.
export async function releaseExpiredHolds(now = new Date()): Promise<number> {
  const expired = await prisma.booking.findMany({
    where: { status: 'pending', holdExpiresAt: { lt: now } },
    select: { id: true },
  });
  if (expired.length === 0) return 0;
  const actorId = await systemActor();
  for (const b of expired) {
    await prisma.booking.update({
      where: { id: b.id },
      data: {
        status: 'cancelled',
        cancellationReason: 'Payment hold expired',
        cancelledAt: now,
        holdExpiresAt: null,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId,
        action: 'booking.hold_expired',
        entity: 'booking',
        entityId: b.id,
        newValue: { status: 'cancelled' },
      },
    });
  }
  return expired.length;
}

async function systemActor(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ['admin', 'super_admin'] } },
    select: { id: true },
  });
  if (!admin) throw new Error('No admin user for system audit');
  return admin.id;
}

// Send 24h / 1h reminders for confirmed bookings, skipping shops that
// disabled reminders and bookings already reminded (dedupe by type).
export async function dispatchReminders(now = new Date()): Promise<number> {
  let sent = 0;
  const windows: { type: BookingEvent; fromMin: number; toMin: number }[] = [
    { type: 'reminder_24h', fromMin: 23 * 60, toMin: 25 * 60 },
    { type: 'reminder_1h', fromMin: 50, toMin: 70 },
  ];
  for (const w of windows) {
    const from = new Date(now.getTime() + w.fromMin * 60_000);
    const to = new Date(now.getTime() + w.toMin * 60_000);
    const due = await prisma.booking.findMany({
      where: { status: 'confirmed', startAt: { gte: from, lte: to } },
      include: {
        shop: { select: { settingsJson: true } },
        notifications: { where: { type: w.type }, select: { id: true } },
      },
    });
    for (const b of due) {
      const settings = (b.shop.settingsJson as Record<string, unknown>) ?? {};
      if (settings.remindersEnabled === false) continue;
      if (b.notifications.length > 0) continue;
      await queueBookingNotifications(b.id, w.type);
      sent += 1;
    }
  }
  return sent;
}

// Auto-detect no-shows: confirmed bookings whose start passed 15+ min ago.
export async function detectNoShows(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 15 * 60_000);
  const missed = await prisma.booking.findMany({
    where: { status: 'confirmed', startAt: { lt: cutoff } },
    include: { service: { select: { price: true } } },
  });
  for (const b of missed) {
    const override = await prisma.staffService.findUnique({
      where: { staffId_serviceId: { staffId: b.staffId, serviceId: b.serviceId } },
    });
    await prisma.booking.update({ where: { id: b.id }, data: { status: 'no_show' } });
    await prisma.payment.create({
      data: {
        bookingId: b.id,
        amount: override?.customPrice ?? b.service.price,
        currency: 'PHP',
        status: 'pending',
        type: 'no_show_fee',
        provider: 'manual',
      },
    });
  }
  return missed.length;
}

export async function runJobs(now = new Date()): Promise<JobSummary> {
  const [holdsReleased, remindersSent, noShowsMarked] = await Promise.all([
    releaseExpiredHolds(now),
    dispatchReminders(now),
    detectNoShows(now),
  ]);
  return { holdsReleased, remindersSent, noShowsMarked, at: now.toISOString() };
}
