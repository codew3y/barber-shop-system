import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, jsonError } from '@/lib/api';
import { isShopAdmin } from '@/lib/staff-scope';
import { cleanOptional, cleanText } from '@/lib/sanitize';
import { updateStaffSchema } from '@/schemas/staff';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  const auth = await requireRole(req, 'admin', 'super_admin');
  if ('error' in auth) return auth.error;
  const { staffId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = updateStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!existing) return jsonError('Staff not found', 404);
  if (!(await isShopAdmin(auth.user.id, auth.user.role, existing.shopId))) {
    return jsonError('Insufficient permissions', 403);
  }

  const staff = await prisma.staff.update({
    where: { id: staffId },
    data: {
      ...parsed.data,
      ...(parsed.data.bio !== undefined ? { bio: cleanOptional(parsed.data.bio, 2000) } : {}),
      ...(parsed.data.title ? { title: cleanText(parsed.data.title, 100) } : {}),
    },
  });
  return NextResponse.json({ staff });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  const auth = await requireRole(req, 'admin', 'super_admin');
  if ('error' in auth) return auth.error;
  const { staffId } = await params;

  const existing = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!existing) return jsonError('Staff not found', 404);
  if (!(await isShopAdmin(auth.user.id, auth.user.role, existing.shopId))) {
    return jsonError('Insufficient permissions', 403);
  }

  await prisma.staff.update({
    where: { id: staffId },
    data: { isActive: false, deletedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
