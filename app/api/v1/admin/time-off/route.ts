import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, jsonError } from '@/lib/api';
import { isShopAdmin } from '@/lib/staff-scope';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, 'admin', 'super_admin');
  if ('error' in auth) return auth.error;

  const shopId = req.nextUrl.searchParams.get('shopId');
  const status = req.nextUrl.searchParams.get('status');
  if (!shopId) return jsonError('shopId is required', 400);
  if (!(await isShopAdmin(auth.user.id, auth.user.role, shopId))) {
    return jsonError('Insufficient permissions', 403);
  }

  const timeOff = await prisma.timeOff.findMany({
    where: {
      staff: { shopId },
      ...(status ? { status: status as 'pending' | 'approved' | 'rejected' } : {}),
    },
    include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
    orderBy: { startAt: 'asc' },
  });
  return NextResponse.json({ timeOff });
}
