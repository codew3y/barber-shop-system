import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@barberhouse/backend/lib/prisma';
import { requireAuth, jsonError, ownsBooking } from '@barberhouse/backend/lib/api';
import { rateLimit } from '@barberhouse/backend/lib/rate-limit';
import {
  createQrIntent,
  fetchIntent,
  isPaymongoTestMode,
  paymongoConfigured,
} from '@barberhouse/backend/lib/paymongo';
import { settlePaidPayment } from '@barberhouse/backend/services/paymentConfirmation';
import { createIntentSchema } from '@barberhouse/backend/schemas/payment';

async function effectivePrice(booking: {
  staffId: string;
  serviceId: string;
  service: { price: unknown };
}): Promise<number> {
  const override = await prisma.staffService.findUnique({
    where: { staffId_serviceId: { staffId: booking.staffId, serviceId: booking.serviceId } },
  });
  return Number(override?.customPrice ?? booking.service.price);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  const limited = await rateLimit(req, 'payment-intent', 10, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = createIntentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    include: {
      service: { select: { price: true, name: true } },
      shop: { select: { settingsJson: true } },
    },
  });
  if (!booking) return jsonError('Booking not found', 404);
  if (!ownsBooking(auth, booking)) return jsonError('Insufficient permissions', 403);
  if (
    booking.status === 'cancelled' ||
    booking.status === 'completed' ||
    booking.status === 'no_show'
  ) {
    return jsonError(`Cannot pay for a ${booking.status} booking`, 400);
  }

  const price = await effectivePrice(booking);
  const settings = (booking.shop.settingsJson as Record<string, unknown>) ?? {};
  const depositPercent = Number(settings.depositPercent ?? 20);
  const amount =
    parsed.data.type === 'deposit' ? Math.round(price * (depositPercent / 100) * 100) / 100 : price;

  if (!paymongoConfigured()) {
    return NextResponse.json(
      { error: 'Payments not configured yet — pay at the shop', configured: false },
      { status: 503 }
    );
  }

  // Never hand out a second code for a booking that already has a live one.
  // Each call used to mint a fresh PaymentIntent, so clicking Pay twice left
  // two payable QRs outstanding — and the natural reaction to a confirmation
  // that never arrives is to click Pay again. That is how someone pays twice
  // for one chair.
  const existing = await prisma.payment.findFirst({
    where: {
      bookingId: booking.id,
      provider: 'paymongo',
      status: { in: ['pending', 'processing'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing?.providerRef) {
    try {
      const live = await fetchIntent(existing.providerRef);

      if (live.paid) {
        // Already settled at PayMongo; the webhook just never arrived.
        // Confirm it rather than charging again.
        await settlePaidPayment(existing.id, live.paymentId);
        return NextResponse.json(
          { alreadyPaid: true, paymentId: existing.id, amount: Number(existing.amount).toFixed(2) },
          { status: 200 }
        );
      }

      if (live.payable && live.qrImageUrl) {
        // Same intent, same code — reopening the panel must not create another.
        return NextResponse.json(
          {
            qrImageUrl: live.qrImageUrl,
            intentId: existing.providerRef,
            paymentId: existing.id,
            amount: Number(existing.amount).toFixed(2),
            reused: true,
            ...(isPaymongoTestMode() && live.testUrl ? { testUrl: live.testUrl } : {}),
          },
          { status: 200 }
        );
      }

      // Cancelled or expired at PayMongo: retire the row so it stops
      // blocking, then fall through and issue a fresh intent.
      await prisma.payment.update({ where: { id: existing.id }, data: { status: 'failed' } });
    } catch (err) {
      // If PayMongo cannot be reached we cannot prove this booking is unpaid,
      // so refuse rather than risk issuing a second payable code.
      console.error('[payments] could not verify existing intent', existing.providerRef, err);
      return jsonError('Could not verify the existing payment — please try again', 409);
    }
  }

  let qr: { intentId: string; clientKey: string; qrImageUrl: string; testUrl: string | null };
  try {
    qr = await createQrIntent({
      amountPesos: amount,
      description: `BarberHouse booking ${booking.id}`,
      metadata: { bookingId: booking.id, type: parsed.data.type, customerId: auth.user.id },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Payment provider error', 502);
  }

  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      amount,
      currency: 'PHP',
      status: 'processing',
      type: parsed.data.type,
      provider: 'paymongo',
      providerRef: qr.intentId,
    },
  });
  return NextResponse.json(
    {
      qrImageUrl: qr.qrImageUrl,
      intentId: qr.intentId,
      paymentId: payment.id,
      amount: amount.toFixed(2),
      // Test mode only: open this to simulate the customer scan. Real
      // bank/e-wallet apps cannot settle a test-mode QR.
      ...(isPaymongoTestMode() && qr.testUrl ? { testUrl: qr.testUrl } : {}),
    },
    { status: 201 }
  );
}
