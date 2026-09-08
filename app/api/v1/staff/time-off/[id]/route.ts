import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, jsonError } from '@/lib/api';
import { isShopAdmin } from '@/lib/staff-scope';
import { reviewTimeOffSchema } from '@/schemas/staff';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, 'admin', 'super_admin');
  if ('error' in auth) return auth.error;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = reviewTimeOffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const timeOff = await prisma.timeOff.findUnique({
    where: { id },
    include: { staff: { select: { shopId: true } } },
  });
  if (!timeOff) return jsonError('Time-off request not found', 404);
  if (!(await isShopAdmin(auth.user.id, auth.user.role, timeOff.staff.shopId))) {
    return jsonError('Insufficient permissions', 403);
  }
  if (timeOff.status !== 'pending') return jsonError(`Already ${timeOff.status}`, 400);

  const updated = await prisma.timeOff.update({
    where: { id },
    data: { status: parsed.data.status, approvedBy: auth.user.id },
  });
  return NextResponse.json({ timeOff: updated });
}
