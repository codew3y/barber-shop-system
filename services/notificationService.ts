import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/smtp';

// Email delivery via SMTP (nodemailer). Without SMTP configured the
// notification rows stay `pending` (visible in status tracking).
// SMS was dropped: email-only notifications.

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
  } catch (err) {
    // Notifications must never break the booking flow.
    console.error('[notify:queue:failed]', err);
  }
}
