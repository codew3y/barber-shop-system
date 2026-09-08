import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, jsonError } from '@/lib/api';
import { isShopAdmin } from '@/lib/staff-scope';
import { cleanOptional, cleanText } from '@/lib/sanitize';
import { upsertServiceSchema } from '@/schemas/staff';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ serviceId: string }> }) {
  const auth = await requireRole(req, 'admin', 'super_admin');
  if ('error' in auth) return auth.error;
  const { serviceId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = upsertServiceSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!existing) return jsonError('Service not found', 404);
  if (!(await isShopAdmin(auth.user.id, auth.user.role, existing.shopId))) {
    return jsonError('Insufficient permissions', 403);
  }

  const { shopId: _omit, ...data } = parsed.data;
  const service = await prisma.service.update({
    where: { id: serviceId },
    data: {
      ...data,
      ...(data.name ? { name: cleanText(data.name, 255) } : {}),
      ...(data.description !== undefined ? { description: cleanOptional(data.description, 2000) } : {}),
      ...(data.category ? { category: cleanText(data.category, 100) } : {}),
    },
  });
  return NextResponse.json({ service });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ serviceId: string }> }) {
  const auth = await requireRole(req, 'admin', 'super_admin');
  if ('error' in auth) return auth.error;
  const { serviceId } = await params;

  const existing = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!existing) return jsonError('Service not found', 404);
  if (!(await isShopAdmin(auth.user.id, auth.user.role, existing.shopId))) {
    return jsonError('Insufficient permissions', 403);
  }

  await prisma.service.update({
    where: { id: serviceId },
    data: { isActive: false, deletedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
