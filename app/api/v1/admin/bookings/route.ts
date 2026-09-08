import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, jsonError } from '@/lib/api';
import { isShopAdmin } from '@/lib/staff-scope';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, 'admin', 'super_admin');
  if ('error' in auth) return auth.error;

  const params = req.nextUrl.searchParams;
  const shopId = params.get('shopId');
  const date = params.get('date');
  const status = params.get('status');
  if (!shopId) return jsonError('shopId is required', 400);
  if (!(await isShopAdmin(auth.user.id, auth.user.role, shopId))) {
    return jsonError('Insufficient permissions', 403);
  }

  const where: {
    shopId: string;
    startAt?: { gte: Date; lte: Date };
    status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  } = { shopId };
  if (date) {
    where.startAt = { gte: new Date(`${date}T00:00:00Z`), lte: new Date(`${date}T23:59:59.999Z`) };
  }
  if (status) {
    if (!['pending', 'confirmed', 'cancelled', 'completed', 'no_show'].includes(status)) {
      return jsonError('Invalid status', 400);
    }
    where.status = status as typeof where.status;
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { startAt: 'asc' },
    take: 100,
    include: {
      service: { select: { name: true } },
      customer: { select: { firstName: true, lastName: true } },
      staff: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  });
  return NextResponse.json({ bookings });
}
