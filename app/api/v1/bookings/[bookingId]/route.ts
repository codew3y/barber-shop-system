import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, jsonError } from '@/lib/api';
import { canActOnBooking } from '@/services/bookingService';

export async function GET(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  const { bookingId } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true, shop: true, staff: { include: { user: { select: { firstName: true, lastName: true } } } }, notifications: { orderBy: { createdAt: 'desc' } } },
  });
  if (!booking) return jsonError('Booking not found', 404);
  if (!(await canActOnBooking(auth.user.id, auth.user.role, booking))) {
    return jsonError('Insufficient permissions', 403);
  }
  return NextResponse.json({ booking });
}
