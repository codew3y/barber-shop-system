import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/smtp';
import { sendPushToUser } from '@/lib/push';
import { channelAllowed, getNotificationPrefs } from '@/lib/preferences';

// Email delivery via SMTP (nodemailer). Without SMTP configured the
// notification rows stay `pending` (visible in status tracking).
// SMS was dropped: email-only notifications.

// Guest checkout accounts get synthetic undeliverable addresses —
// emailing them only produces bounces, so we skip those silently.
export function isGuestEmail(email: string): boolean {
  return email.toLowerCase().endsWith('@barberhouse.local');
}

export type BookingEvent =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'reminder_24h'
  | 'reminder_1h';

function subjectFor(
  event: BookingEvent,
  serviceName: string,
  shopName: string
): string {
  switch (event) {
    case 'booking_confirmed':
      return `Booking confirmed: ${serviceName} at ${shopName}`;
    case 'booking_cancelled':
      return `Booking cancelled: ${serviceName} at ${shopName}`;
    case 'booking_rescheduled':
      return `Booking rescheduled: ${serviceName} at ${shopName}`;
    case 'reminder_24h':
      return `Reminder: ${serviceName} at ${shopName} tomorrow`;
    case 'reminder_1h':
      return `Reminder: ${serviceName} at ${shopName} in one hour`;
  }
}

export async function queueBookingNotifications(bookingId: string, event: BookingEvent): Promise<void> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { select: { id: true, email: true, phone: true } },
        service: { select: { name: true } },
        shop: { select: { name: true } },
      },
    });
    if (!booking) return;

    const when = booking.startAt.toLocaleString();
    const subject = subjectFor(event, booking.service.name, booking.shop.name);
    const text = `${subject} — ${when}.`;
    const to = booking.customer.email;
    if (!to) return;
    if (isGuestEmail(to)) {
      console.log(`[notify:skip] guest address ${to} — no email queued`);
      return;
    }

    // Phase 5.2: per-user channel preferences (no row = everything on).
    const prefs = await getNotificationPrefs(booking.customer.id);

    if (channelAllowed(prefs, event, 'email')) {
      const notification = await prisma.notification.create({
        data: {
          bookingId,
          userId: booking.customer.id,
          channel: 'email',
          type: event,
          status: 'pending',
          subject,
          content: text,
        },
      });
      if (await sendEmail(to, subject, text)) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: 'sent', sentAt: new Date() },
        });
      }
    } else {
      console.log(`[notify:skip] ${event} email disabled for user ${booking.customer.id}`);
    }

    if (channelAllowed(prefs, event, 'push')) {
      const { sent, failed } = await sendPushToUser(booking.customer.id, {
        title: subject,
        body: text,
        url: `/bookings/${bookingId}`,
      });
      // No row when the user has no subscriptions — nothing was attempted.
      if (sent + failed > 0) {
        await prisma.notification.create({
          data: {
            bookingId,
            userId: booking.customer.id,
            channel: 'push',
            type: event,
            status: sent > 0 ? 'sent' : 'failed',
            subject,
            content: text,
            sentAt: sent > 0 ? new Date() : null,
          },
        });
      }
    } else {
      console.log(`[notify:skip] ${event} push disabled for user ${booking.customer.id}`);
    }
  } catch (err) {
    // Notifications must never break the booking flow.
    console.error('[notify:queue:failed]', err);
  }
}
