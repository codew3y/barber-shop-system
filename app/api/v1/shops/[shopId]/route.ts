import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const shop = await prisma.shop.findFirst({ where: { id: shopId, deletedAt: null } });
  if (!shop || !shop.isActive) return jsonError('Shop not found', 404);

  const [services, staff] = await Promise.all([
    prisma.service.findMany({ where: { shopId, isActive: true, deletedAt: null } }),
    prisma.staff.findMany({
      where: { shopId, isActive: true, deletedAt: null },
      include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    }),
  ]);
  return NextResponse.json({ shop, services, staff });
}
