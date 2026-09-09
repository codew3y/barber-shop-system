import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, jsonError } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { createQrIntent, paymongoConfigured } from '@/lib/paymongo';
import { createIntentSchema } from '@/schemas/payment';

async function effectivePrice(booking: { staffId: string; serviceId: string; service: { price: unknown } }): Promise<number> {
  const override = await prisma.staffService.findUnique({
    where: { staffId_serviceId: { staffId: booking.staffId, serviceId: booking.serviceId } },
  });
  return Number(override?.customPrice ?? booking.service.price);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  const limited = rateLimit(req, 'payment-intent', 10, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = createIntentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    include: { service: { select: { price: true, name: true } }, shop: { select: { settingsJson: true } } },
  });
  if (!booking) return jsonError('Booking not found', 404);
  if (booking.customerId !== auth.user.id) return jsonError('Insufficient permissions', 403);
  if (booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'no_show') {
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

  let qr: { intentId: string; clientKey: string; qrImageUrl: string };
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
    },
    { status: 201 }
  );
}
