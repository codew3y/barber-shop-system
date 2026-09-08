import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, jsonError } from '@/lib/api';
import { resolveStaffProfile } from '@/lib/staff-scope';
import { cleanOptional } from '@/lib/sanitize';
import { createTimeOffSchema } from '@/schemas/staff';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, 'staff', 'admin', 'super_admin');
  if ('error' in auth) return auth.error;

  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { profile, error } = await resolveStaffProfile(auth.user.id, auth.user.role, {
    shopId: query.shopId,
    staffId: query.staffId,
  });
  if (!profile) {
    return NextResponse.json({ error: error ?? 'No staff profile' }, { status: 404 });
  }

  const timeOff = await prisma.timeOff.findMany({
    where: { staffId: profile.id },
    orderBy: { startAt: 'asc' },
  });
  return NextResponse.json({ timeOff });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, 'staff', 'admin', 'super_admin');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = createTimeOffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { profile, error } = await resolveStaffProfile(auth.user.id, auth.user.role, {
    shopId: parsed.data.shopId,
  });
  if (!profile) {
    return NextResponse.json({ error: error ?? 'No staff profile' }, { status: 404 });
  }

  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    return jsonError('Invalid time-off range', 400);
  }

  const timeOff = await prisma.timeOff.create({
    data: { staffId: profile.id, startAt, endAt, reason: cleanOptional(parsed.data.reason, 500) },
  });
  return NextResponse.json({ timeOff }, { status: 201 });
}
