import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const shop = await prisma.shop.findFirst({ where: { id: shopId, deletedAt: null } });
  if (!shop) return jsonError('Shop not found', 404);
  const services = await prisma.service.findMany({
    where: { shopId, isActive: true, deletedAt: null },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ services });
}
