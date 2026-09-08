import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, jsonError } from '@/lib/api';
import { isShopAdmin } from '@/lib/staff-scope';
import { createRefund } from '@/lib/stripe';
import { refundSchema } from '@/schemas/payment';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, 'admin', 'super_admin');
  if ('error' in auth) return auth.error;
  const { id } = await params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = refundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { booking: { select: { shopId: true } } },
  });
  if (!payment) return jsonError('Payment not found', 404);
  if (!(await isShopAdmin(auth.user.id, auth.user.role, payment.booking.shopId))) {
    return jsonError('Insufficient permissions', 403);
  }
  if (payment.status !== 'completed') {
    return jsonError(`Cannot refund a ${payment.status} payment`, 400);
  }
  if (!payment.providerRef) return jsonError('No provider reference', 400);
  if (parsed.data.amount && parsed.data.amount > Number(payment.amount)) {
    return jsonError('Refund exceeds payment amount', 400);
  }

  try {
    await createRefund(payment.providerRef, parsed.data.amount);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Refund failed', 502);
  }

  const isFull = !parsed.data.amount || parsed.data.amount >= Number(payment.amount);
  const [updated] = await Promise.all([
    prisma.payment.update({
      where: { id },
      data: { status: isFull ? 'refunded' : 'partially_refunded' },
    }),
    prisma.payment.create({
      data: {
        bookingId: payment.bookingId,
        amount: parsed.data.amount ?? payment.amount,
        currency: payment.currency,
        status: 'completed',
        type: 'refund',
        provider: payment.provider,
        providerRef: payment.providerRef,
      },
    }),
  ]);
  return NextResponse.json({ payment: updated });
}
