import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, jsonError } from '@/lib/api';
import { isShopAdmin } from '@/lib/staff-scope';
import { analyticsQuerySchema } from '@/schemas/staff';

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / 60_000);
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, 'admin', 'super_admin');
  if ('error' in auth) return auth.error;

  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = analyticsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Default to the admin's first shop when omitted (single-brand setup).
  let shopId = parsed.data.shopId;
  if (!shopId) {
    const owned = await prisma.shop.findFirst({
      where: { ownerId: auth.user.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const staffed = owned
      ? null
      : await prisma.staff.findFirst({
          where: { userId: auth.user.id, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        });
    shopId = owned?.id ?? staffed?.shopId;
    if (!shopId) return jsonError('No shop found', 404);
  }
  if (!(await isShopAdmin(auth.user.id, auth.user.role, shopId))) {
    return jsonError('Insufficient permissions', 403);
  }

  const start = new Date(`${parsed.data.startDate}T00:00:00Z`);
  const end = new Date(`${parsed.data.endDate}T23:59:59.999Z`);

  const bookings = await prisma.booking.findMany({
    where: { shopId, startAt: { gte: start, lte: end } },
    include: { service: { select: { price: true, durationMinutes: true } } },
  });

  const overrides = await prisma.staffService.findMany({
    where: { staff: { shopId } },
  });
  const overrideByKey = new Map(overrides.map((o) => [`${o.staffId}:${o.serviceId}`, o.customPrice]));

  let revenue = 0;
  const byStatus: Record<string, number> = {};
  let bookedMinutes = 0;
  for (const b of bookings) {
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
    if (b.status === 'cancelled' || b.status === 'no_show') continue;
    const custom = overrideByKey.get(`${b.staffId}:${b.serviceId}`);
    revenue += Number(custom ?? b.service.price);
    bookedMinutes += minutesBetween(b.startAt, b.endAt);
  }

  // Available minutes from weekly working hours across active staff,
  // minus approved time off overlapping the range.
  const staffList = await prisma.staff.findMany({
    where: { shopId, isActive: true, deletedAt: null },
    include: {
      availability: { where: { isActive: true } },
      timeOff: {
        where: { status: 'approved', startAt: { lte: end }, endAt: { gte: start } },
      },
    },
  });

  const toMinutes = (t: Date) => t.getUTCHours() * 60 + t.getUTCMinutes();
  let availableMinutes = 0;
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86_400_000)) {
    const dow = d.getUTCDay();
    const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    for (const s of staffList) {
      for (const a of s.availability.filter((x) => x.dayOfWeek === dow)) {
        let mins = toMinutes(a.endTime) - toMinutes(a.startTime);
        for (const t of s.timeOff) {
          const overlapStart = t.startAt > dayStart ? t.startAt : dayStart;
          const overlapEnd = t.endAt < dayEnd ? t.endAt : dayEnd;
          if (overlapEnd <= overlapStart) continue;
          const wStart = new Date(dayStart.getTime() + toMinutes(a.startTime) * 60_000);
          const wEnd = new Date(dayStart.getTime() + toMinutes(a.endTime) * 60_000);
          const oStart = overlapStart > wStart ? overlapStart : wStart;
          const oEnd = overlapEnd < wEnd ? overlapEnd : wEnd;
          mins -= minutesBetween(oStart, oEnd);
        }
        availableMinutes += Math.max(0, mins);
      }
    }
  }

  const total = bookings.length;
  const noShows = byStatus['no_show'] ?? 0;
  return NextResponse.json({
    shopId,
    revenue: revenue.toFixed(2),
    bookings: total,
    byStatus,
    noShowRate: total === 0 ? 0 : Number((noShows / total).toFixed(3)),
    bookedMinutes: Math.round(bookedMinutes),
    availableMinutes: Math.round(availableMinutes),
    utilization: availableMinutes === 0 ? 0 : Number((bookedMinutes / availableMinutes).toFixed(3)),
  });
}
