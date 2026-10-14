import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@barberhouse/backend/lib/prisma';
import { requireAuth } from '@barberhouse/backend/lib/api';
import { myBookingsQuerySchema } from '@barberhouse/backend/schemas/booking';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = myBookingsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { status, page, limit } = parsed.data;

  const where = {
    customerId: auth.user.id,
    ...(auth.guestSince ? { createdAt: { gte: auth.guestSince } } : {}),
    ...(status ? { status } : {}),
  };
  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { startAt: 'asc' },
      include: { service: true, shop: true, staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
    }),
  ]);
  return NextResponse.json({ bookings, pagination: { page, limit, total } });
}
