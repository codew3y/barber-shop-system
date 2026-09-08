import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const shop = await prisma.shop.findFirst({ where: { id: shopId, deletedAt: null } });
  if (!shop) return jsonError('Shop not found', 404);
  const staff = await prisma.staff.findMany({
    where: { shopId, isActive: true, deletedAt: null },
    include: {
      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
      services: {
        select: {
          customPrice: true,
          service: { select: { id: true, name: true } },
        },
      },
    },
  });
  return NextResponse.json({ staff });
}
