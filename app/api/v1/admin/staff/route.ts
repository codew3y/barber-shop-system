import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole, jsonError } from '@/lib/api';
import { isShopAdmin } from '@/lib/staff-scope';

const createStaffSchema = z.object({
  userId: z.string().uuid(),
  shopId: z.string().uuid(),
  bio: z.string().max(2000).optional(),
  title: z.string().max(100).optional(),
  specialties: z.array(z.string().max(100)).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, 'admin', 'super_admin');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = createStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  if (!(await isShopAdmin(auth.user.id, auth.user.role, parsed.data.shopId))) {
    return jsonError('Insufficient permissions', 403);
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user || user.deletedAt) return jsonError('User not found', 404);

  const staff = await prisma.staff.upsert({
    where: { userId_shopId: { userId: parsed.data.userId, shopId: parsed.data.shopId } },
    update: { isActive: true, deletedAt: null },
    create: {
      userId: parsed.data.userId,
      shopId: parsed.data.shopId,
      bio: parsed.data.bio,
      title: parsed.data.title ?? 'Hairstylist & Barber',
      specialties: parsed.data.specialties ?? [],
      commissionRate: parsed.data.commissionRate ?? 0,
    },
  });
  return NextResponse.json({ staff }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, 'admin', 'super_admin');
  if ('error' in auth) return auth.error;

  const shopId = req.nextUrl.searchParams.get('shopId');
  const staff = await prisma.staff.findMany({
    where: { ...(shopId ? { shopId } : {}), deletedAt: null },
    include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ staff });
}
