import { prisma } from '../lib/prisma';
import { fetchIntent } from '../lib/paymongo';
import { queueBookingNotifications } from './notificationService';
import { emitShopEvent } from '../lib/events';

/**
 * Settling a paid booking, in one place.
 *
 * This used to live only inside the webhook handler, which made the webhook
 * the single point of failure for money: if the delivery never arrived —
 * unregistered endpoint, wrong signing secret, test/live mismatch — PayMongo
 * had the customer's payment while the booking stayed `pending` until the
 * hold expired and the job cancelled it. Paid, and no chair.
 *
 * Both the webhook and the reconciliation path below now call this, so the
 * two can never drift apart.
 *
 * Idempotent: a payment already `completed`, or a booking no longer
 * `pending`, is left exactly as it is. PayMongo redelivers events, and
 * reconciliation can race a webhook that lands at the same moment.
 */
export async function settlePaidPayment(
  paymentId: string,
  providerChargeId?: string | null
): Promise<{ confirmed: boolean }> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status === 'completed') return { confirmed: false };

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'completed',
      ...(providerChargeId ? { providerChargeId } : {}),
    },
  });

  const booking = await prisma.booking.findUnique({ where: { id: payment.bookingId } });
  if (!booking || booking.status !== 'pending') return { confirmed: false };

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'confirmed', holdExpiresAt: null },
  });
  void queueBookingNotifications(booking.id, 'booking_confirmed');
  emitShopEvent({
    type: 'booking.confirmed',
    shopId: booking.shopId,
    bookingId: booking.id,
    customerId: booking.customerId,
    staffId: booking.staffId,
    status: 'confirmed',
  });
  return { confirmed: true };
}

/**
 * Ask PayMongo whether a still-pending booking has in fact been paid.
 *
 * Called from the booking read the client already polls, so a payment that
 * succeeded without a webhook heals itself within a few seconds instead of
 * silently expiring. Deliberately quiet: reconciliation is a safety net, and
 * a provider outage here must not break reading a booking.
 */
export async function reconcileBookingPayment(bookingId: string): Promise<boolean> {
  const payment = await prisma.payment.findFirst({
    where: {
      bookingId,
      provider: 'paymongo',
      status: { in: ['pending', 'processing'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!payment?.providerRef) return false;

  try {
    const intent = await fetchIntent(payment.providerRef);
    if (!intent.paid) return false;
    const { confirmed } = await settlePaidPayment(payment.id, intent.paymentId);
    return confirmed;
  } catch (err) {
    console.error('[payments] reconcile failed for booking', bookingId, err);
    return false;
  }
}
