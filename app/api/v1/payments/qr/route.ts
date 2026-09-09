import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth, jsonError } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const qrSchema = z.object({
  bookingId: z.string().uuid(),
  type: z.enum(['deposit', 'full']).default('deposit'),
});

// QRPh scan-to-pay: records a pending downpayment tied to a reference code.
// The customer scans the code, pays the amount in their e-wallet, and the
// shop confirms on the staff dashboard. No card data touches our servers.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  const limited = rateLimit(req, 'payment-qr', 10, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = qrSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    include: { service: { select: { price: true } }, shop: { select: { settingsJson: true } } },
  });
  if (!booking) return jsonError('Booking not found', 404);
  if (booking.customerId !== auth.user.id) return jsonError('Insufficient permissions', 403);
  if (booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'no_show') {
    return jsonError(`Cannot pay for a ${booking.status} booking`, 400);
  }

  const existing = await prisma.payment.findFirst({
    where: { bookingId: booking.id, status: { in: ['pending', 'processing', 'completed'] } },
  });
  if (existing) {
    return NextResponse.json({
      paymentId: existing.id,
      amount: Number(existing.amount).toFixed(2),
      reference: existing.providerRef,
    });
  }

  const override = await prisma.staffService.findUnique({
    where: { staffId_serviceId: { staffId: booking.staffId, serviceId: booking.serviceId } },
  });
  const price = Number(override?.customPrice ?? booking.service.price);
  const settings = (booking.shop.settingsJson as Record<string, unknown>) ?? {};
  const depositPercent = Number(settings.depositPercent ?? 20);
  const amount =
    parsed.data.type === 'deposit' ? Math.round(price * (depositPercent / 100) * 100) / 100 : price;
  const reference = `BH-${randomBytes(4).toString('hex').toUpperCase()}`;

  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      amount,
      currency: 'PHP',
      status: 'pending',
      type: parsed.data.type,
      provider: 'qrph',
      providerRef: reference,
    },
  });
  return NextResponse.json(
    { paymentId: payment.id, amount: amount.toFixed(2), reference },
    { status: 201 }
  );
}
