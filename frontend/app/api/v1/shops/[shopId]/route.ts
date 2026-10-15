import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@barberhouse/backend/lib/prisma';
import { jsonError } from '@barberhouse/backend/lib/api';
import { publicShopSelect } from '@barberhouse/backend/lib/public-shop';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  // isActive moves into the filter so it never has to be selected and then
  // stripped: an inactive shop is simply not found, same 404 as before.
  const shop = await prisma.shop.findFirst({
    where: { id: shopId, deletedAt: null, isActive: true },
    select: publicShopSelect,
  });
  if (!shop) return jsonError('Shop not found', 404);

  const [services, staff] = await Promise.all([
    prisma.service.findMany({ where: { shopId, isActive: true, deletedAt: null } }),
    prisma.staff.findMany({
      where: { shopId, isActive: true, deletedAt: null },
      include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    }),
  ]);
  return NextResponse.json({ shop, services, staff });
}
