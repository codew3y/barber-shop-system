import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature, type PmWebhookEvent } from '@/lib/paymongo';
import { queueBookingNotifications } from '@/services/notificationService';
import { emitShopEvent } from '@/lib/events';

async function findPayment(event: PmWebhookEvent) {
  // Primary: match by intent id stored at create-intent time.
  if (event.intentId) {
    const byIntent = await prisma.payment.findFirst({
      where: { providerRef: event.intentId },
    });
    if (byIntent) return byIntent;
  }
  // Fallback: booking id echoed in intent metadata.
  if (event.bookingId) {
    const byBooking = await prisma.payment.findFirst({
      where: {
        bookingId: event.bookingId,
        provider: 'paymongo',
        status: { in: ['pending', 'processing'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (byBooking) return byBooking;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('paymongo-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: PmWebhookEvent;
  try {
    const payload = await req.text();
    event = verifyWebhookSignature(payload, signature);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Idempotent: PayMongo may redeliver events.
  if (event.type === 'payment.paid') {
    const payment = await findPayment(event);
    if (payment && payment.status !== 'completed') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'completed',
          ...(event.paymentId ? { providerChargeId: event.paymentId } : {}),
        },
      });
      const booking = await prisma.booking.findUnique({ where: { id: payment.bookingId } });
      if (booking && booking.status === 'pending') {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'confirmed', holdExpiresAt: null },
        });
        void queueBookingNotifications(booking.id, 'booking_confirmed');
        emitShopEvent({ type: 'booking.confirmed', shopId: booking.shopId, bookingId: booking.id, customerId: booking.customerId, staffId: booking.staffId, status: 'confirmed' });
      }
    }
  } else if (event.type === 'payment.failed' || event.type === 'qrph.expired') {
    const payment = await findPayment(event);
    if (payment && (payment.status === 'pending' || payment.status === 'processing')) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
    }
  }

  return NextResponse.json({ received: true });
}
