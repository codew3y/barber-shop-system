import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@barberhouse/backend/lib/prisma';
import { verifyWebhookSignature, type PmWebhookEvent } from '@barberhouse/backend/lib/paymongo';
import { settlePaidPayment } from '@barberhouse/backend/services/paymentConfirmation';

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
    // Settlement lives in one shared place so this and the reconciliation
    // path in the booking read can never diverge.
    if (payment) await settlePaidPayment(payment.id, event.paymentId);
  } else if (event.type === 'payment.failed' || event.type === 'qrph.expired') {
    const payment = await findPayment(event);
    if (payment && (payment.status === 'pending' || payment.status === 'processing')) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
    }
  }

  return NextResponse.json({ received: true });
}
