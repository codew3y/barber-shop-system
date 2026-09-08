import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, jsonError } from '@/lib/api';
import { canActOnBooking } from '@/services/bookingService';
import { queueBookingNotifications } from '@/services/notificationService';
import { cancelBookingSchema } from '@/schemas/booking';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  const { bookingId } = await params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = cancelBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return jsonError('Booking not found', 404);
  if (!(await canActOnBooking(auth.user.id, auth.user.role, booking))) {
    return jsonError('Insufficient permissions', 403);
  }
  if (booking.status === 'cancelled') return jsonError('Booking already cancelled', 400);
  if (booking.status === 'completed' || booking.status === 'no_show') {
    return jsonError(`Cannot cancel a ${booking.status} booking`, 400);
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'cancelled',
      cancellationReason: parsed.data.reason,
      cancelledBy: auth.user.id,
      cancelledAt: new Date(),
      holdExpiresAt: null,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: auth.user.id,
      action: 'booking.cancelled',
      entity: 'booking',
      entityId: bookingId,
      oldValue: { status: booking.status },
      newValue: { status: 'cancelled', reason: parsed.data.reason ?? null },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    },
  });
  // Refund processing lands in Phase 5; cancellation frees the slot now.
  void queueBookingNotifications(bookingId, 'booking_cancelled');
  return NextResponse.json({ booking: updated });
}
