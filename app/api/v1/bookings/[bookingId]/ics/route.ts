import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, jsonError } from '@/lib/api';
import { canActOnBooking } from '@/services/bookingService';

function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  const { bookingId } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: { select: { name: true, description: true } },
      shop: { select: { name: true, addressLine1: true, city: true, state: true } },
      staff: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!booking) return jsonError('Booking not found', 404);
  if (!(await canActOnBooking(auth.user.id, auth.user.role, booking))) {
    return jsonError('Insufficient permissions', 403);
  }

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BarberHouse//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${booking.id}@barberhouse`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(booking.startAt)}`,
    `DTEND:${toICSDate(booking.endAt)}`,
    `SUMMARY:${icsEscape(`${booking.service.name} at ${booking.shop.name}`)}`,
    `DESCRIPTION:${icsEscape(`Barber: ${booking.staff.user.firstName} ${booking.staff.user.lastName}. Status: ${booking.status}.`)}`,
    `LOCATION:${icsEscape(`${booking.shop.addressLine1}, ${booking.shop.city}, ${booking.shop.state}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new NextResponse(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="booking-${booking.id}.ics"`,
    },
  });
}
