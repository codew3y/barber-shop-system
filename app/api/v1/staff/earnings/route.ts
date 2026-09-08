import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';
import { resolveStaffProfile } from '@/lib/staff-scope';
import { earningsQuerySchema } from '@/schemas/staff';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, 'staff', 'admin', 'super_admin');
  if ('error' in auth) return auth.error;

  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = earningsQuerySchema.safeParse(query);
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

  const start = new Date(`${parsed.data.startDate}T00:00:00Z`);
  const end = new Date(`${parsed.data.endDate}T23:59:59.999Z`);

  const bookings = await prisma.booking.findMany({
    where: {
      staffId: profile.id,
      status: { in: ['completed', 'confirmed'] },
      startAt: { gte: start, lte: end },
    },
    include: {
      service: { select: { price: true } },
    },
  });

  // Effective price prefers a per-barber override when present.
  const overrides = await prisma.staffService.findMany({ where: { staffId: profile.id } });
  const overrideByService = new Map(overrides.map((o) => [o.serviceId, o.customPrice]));

  let revenue = 0;
  for (const b of bookings) {
    const custom = overrideByService.get(b.serviceId);
    revenue += Number(custom ?? b.service.price);
  }
  const commissionRate = Number(profile.commissionRate);
  const earnings = (revenue * commissionRate) / 100;

  return NextResponse.json({
    staffId: profile.id,
    bookings: bookings.length,
    revenue: revenue.toFixed(2),
    commissionRate: commissionRate.toFixed(2),
    earnings: earnings.toFixed(2),
  });
}
