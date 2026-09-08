import { prisma } from '@/lib/prisma';

// Provider delivery for Phase 3.6: SendGrid (email) + Twilio (SMS).
// Without provider keys configured the notification rows stay `pending`
// (visible in status tracking) and Phase 5 wires scheduled delivery +
// webhooks. With keys set, we attempt immediate send.

async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL ?? 'no-reply@example.com';
  if (!apiKey) {
    console.log(`[notify:email:pending] to=${to} subject=${subject}`);
    return false;
  }
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject,
        content: [{ type: 'text/plain', value: text }],
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('[notify:email:failed]', err);
    return false;
  }
}

async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.log(`[notify:sms:pending] to=${to} body=${body.slice(0, 80)}`);
    return false;
  }
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      }
    );
    return res.ok;
  } catch (err) {
    console.error('[notify:sms:failed]', err);
    return false;
  }
}

export type BookingEvent = 'booking_confirmed' | 'booking_cancelled' | 'booking_rescheduled';

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
    const subject =
      event === 'booking_confirmed'
        ? `Booking confirmed: ${booking.service.name} at ${booking.shop.name}`
        : event === 'booking_cancelled'
          ? `Booking cancelled: ${booking.service.name} at ${booking.shop.name}`
          : `Booking rescheduled: ${booking.service.name} at ${booking.shop.name}`;
    const text = `${subject} — ${when}.`;

    const targets: { channel: 'email' | 'sms'; to: string | null }[] = [
      { channel: 'email', to: booking.customer.email },
      { channel: 'sms', to: booking.customer.phone },
    ];

    for (const { channel, to } of targets) {
      if (!to) continue;
      const notification = await prisma.notification.create({
        data: {
          bookingId,
          userId: booking.customer.id,
          channel,
          type: event,
          status: 'pending',
          subject,
          content: text,
        },
      });
      const delivered =
        channel === 'email' ? await sendEmail(to, subject, text) : await sendSms(to, text);
      if (delivered) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: 'sent', sentAt: new Date() },
        });
      }
    }
  } catch (err) {
    // Notifications must never break the booking flow.
    console.error('[notify:queue:failed]', err);
  }
}
