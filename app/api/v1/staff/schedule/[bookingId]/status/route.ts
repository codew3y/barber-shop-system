import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, jsonError } from '@/lib/api';
import { isShopAdmin } from '@/lib/staff-scope';
import { updateBookingStatusSchema } from '@/schemas/staff';

const ALLOWED: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled', 'no_show'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export async function PUT(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const auth = await requireRole(req, 'staff', 'admin', 'super_admin');
  if ('error' in auth) return auth.error;
  const { bookingId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = updateBookingStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return jsonError('Booking not found', 404);

  const ownProfile = await prisma.staff.findFirst({
    where: { userId: auth.user.id, shopId: booking.shopId, deletedAt: null },
  });
  const isAssigned = ownProfile?.id === booking.staffId;
  const admin = await isShopAdmin(auth.user.id, auth.user.role, booking.shopId);
  if (!isAssigned && !admin) return jsonError('Insufficient permissions', 403);

  if (!ALLOWED[booking.status]?.includes(parsed.data.status)) {
    return jsonError(`Cannot move booking from ${booking.status} to ${parsed.data.status}`, 400);
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: parsed.data.status,
      ...(parsed.data.status === 'cancelled'
        ? { cancelledBy: auth.user.id, cancelledAt: new Date(), holdExpiresAt: null }
        : { holdExpiresAt: null }),
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: auth.user.id,
      action: `booking.${parsed.data.status}`,
      entity: 'booking',
      entityId: bookingId,
      oldValue: { status: booking.status },
      newValue: { status: parsed.data.status },
    },
  });
  // Manual-payment acknowledgment: the confirmation email goes out now
  // (PayMongo path sends it from the webhook instead).
  if (parsed.data.status === 'confirmed' && booking.status === 'pending') {
    const { queueBookingNotifications } = await import('@/services/notificationService');
    void queueBookingNotifications(bookingId, 'booking_confirmed');
  }
  return NextResponse.json({ booking: updated });
}
