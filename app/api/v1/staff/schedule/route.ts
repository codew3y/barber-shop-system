import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';
import { resolveStaffProfile } from '@/lib/staff-scope';
import { scheduleQuerySchema } from '@/schemas/staff';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, 'staff', 'admin', 'super_admin');
  if ('error' in auth) return auth.error;

  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = scheduleQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { profile, error } = await resolveStaffProfile(auth.user.id, auth.user.role, {
    shopId: parsed.data.shopId,
    staffId: query.staffId,
  });
  if (!profile) {
    return NextResponse.json({ error: error ?? 'No staff profile' }, { status: 404 });
  }

  const date = parsed.data.date ?? new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const bookings = await prisma.booking.findMany({
    where: { staffId: profile.id, startAt: { gte: dayStart, lte: dayEnd } },
    orderBy: { startAt: 'asc' },
    include: {
      service: { select: { id: true, name: true, durationMinutes: true, price: true } },
      customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, isGuest: true } },
    },
  });
  return NextResponse.json({ schedule: bookings, staffId: profile.id, shopId: profile.shopId, date });
}
