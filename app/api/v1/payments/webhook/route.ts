import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature } from '@/lib/stripe';
import { queueBookingNotifications } from '@/services/notificationService';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event;
  try {
    const payload = await req.text();
    event = verifyWebhookSignature(payload, signature);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Idempotent: Stripe may redeliver events.
  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as { id: string; metadata?: Record<string, string> };
    const payment = await prisma.payment.findFirst({ where: { providerRef: intent.id } });
    if (payment && payment.status !== 'completed') {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'completed' } });
      const booking = await prisma.booking.findUnique({ where: { id: payment.bookingId } });
      if (booking && booking.status === 'pending') {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'confirmed', holdExpiresAt: null },
        });
        void queueBookingNotifications(booking.id, 'booking_confirmed');
      }
    }
  } else if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as { id: string };
    const payment = await prisma.payment.findFirst({ where: { providerRef: intent.id } });
    if (payment && payment.status !== 'failed') {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
    }
  }

  return NextResponse.json({ received: true });
}
