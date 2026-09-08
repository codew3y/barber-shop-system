import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, jsonError } from '@/lib/api';
import { isShopAdmin } from '@/lib/staff-scope';
import { upsertServiceSchema } from '@/schemas/staff';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, 'admin', 'super_admin');
  if ('error' in auth) return auth.error;

  const shopId = req.nextUrl.searchParams.get('shopId');
  const services = await prisma.service.findMany({
    where: { ...(shopId ? { shopId } : {}), deletedAt: null },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ services });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, 'admin', 'super_admin');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = upsertServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const shopId = parsed.data.shopId ?? req.nextUrl.searchParams.get('shopId');
  if (!shopId) return jsonError('shopId is required', 400);
  if (!(await isShopAdmin(auth.user.id, auth.user.role, shopId))) {
    return jsonError('Insufficient permissions', 403);
  }

  const { shopId: _omit, ...data } = parsed.data;
  const service = await prisma.service.create({ data: { ...data, shopId } });
  return NextResponse.json({ service }, { status: 201 });
}
