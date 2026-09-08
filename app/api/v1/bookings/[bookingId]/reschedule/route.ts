import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, jsonError } from '@/lib/api';
import { HOLD_MINUTES, canActOnBooking, validateSlotAvailability } from '@/services/bookingService';
import { queueBookingNotifications } from '@/services/notificationService';
import { rescheduleBookingSchema } from '@/schemas/booking';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  const { bookingId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = rescheduleBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return jsonError('Booking not found', 404);
  if (!(await canActOnBooking(auth.user.id, auth.user.role, booking))) {
    return jsonError('Insufficient permissions', 403);
  }
  if (booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'no_show') {
    return jsonError(`Cannot reschedule a ${booking.status} booking`, 400);
  }

  const newStart = new Date(parsed.data.newStartTime);
  if (Number.isNaN(newStart.getTime())) return jsonError('Invalid newStartTime', 400);

  // Old slot is released by excluding this booking from the overlap check,
  // then the row is updated to the new slot.
  const check = await validateSlotAvailability(
    booking.staffId,
    booking.serviceId,
    booking.shopId,
    newStart,
    bookingId
  );
  if (!check.valid || !check.endTime) {
    return jsonError(check.error ?? 'Slot unavailable', 409);
  }

  try {
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        startAt: newStart,
        endAt: check.endTime,
        status: 'pending',
        holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: auth.user.id,
        action: 'booking.rescheduled',
        entity: 'booking',
        entityId: bookingId,
        oldValue: { startAt: booking.startAt.toISOString(), endAt: booking.endAt.toISOString() },
        newValue: { startAt: updated.startAt.toISOString(), endAt: updated.endAt.toISOString() },
      },
    });
    void queueBookingNotifications(bookingId, 'booking_rescheduled');
    return NextResponse.json({ booking: updated, holdExpiresAt: updated.holdExpiresAt });
  } catch {
    return jsonError('Time slot is no longer available', 409);
  }
}
