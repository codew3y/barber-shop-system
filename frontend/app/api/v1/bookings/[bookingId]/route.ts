import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@barberhouse/backend/lib/prisma';
import { requireAuth, jsonError } from '@barberhouse/backend/lib/api';
import { canActOnBooking } from '@barberhouse/backend/services/bookingService';
import { reconcileBookingPayment } from '@barberhouse/backend/services/paymentConfirmation';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  const { bookingId } = await params;

  const include = {
    service: true,
    shop: true,
    staff: { include: { user: { select: { firstName: true, lastName: true } } } },
    notifications: { orderBy: { createdAt: 'desc' as const } },
  };

  let booking = await prisma.booking.findUnique({ where: { id: bookingId }, include });
  if (!booking) return jsonError('Booking not found', 404);
  if (!(await canActOnBooking(auth.user.id, auth.user.role, booking, auth.guestSince))) {
    return jsonError('Insufficient permissions', 403);
  }

  // The client polls this route while the QR panel is open. If the payment
  // succeeded but the webhook never arrived, ask PayMongo directly rather
  // than leaving a paid booking to expire. Only for the owner's own pending
  // booking, so this costs a provider call only where it can actually help.
  if (booking.status === 'pending' && booking.customerId === auth.user.id) {
    if (await reconcileBookingPayment(bookingId)) {
      booking = await prisma.booking.findUnique({ where: { id: bookingId }, include });
    }
  }

  return NextResponse.json({ booking });
}
