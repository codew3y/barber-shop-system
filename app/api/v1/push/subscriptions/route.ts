import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, jsonError } from '@/lib/api';
import {
  deletePushSubscriptionSchema,
  upsertPushSubscriptionSchema,
} from '@/schemas/notifications';

// Browser push subscriptions (Phase 4.3). Endpoints are opaque bearer
// URLs — a user may only touch their own rows, matched by userId.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: auth.user.id },
    select: { endpoint: true, userAgent: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ subscriptions: subs });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = upsertPushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { endpoint, keys, userAgent } = parsed.data;
  // Same browser re-subscribing yields the same endpoint — upsert, and
  // never let one user claim another user's endpoint row.
  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
  if (existing && existing.userId !== auth.user.id) {
    await prisma.pushSubscription.delete({ where: { endpoint } });
  }
  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: auth.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    update: { userId: auth.user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent },
  });
  return NextResponse.json({ subscription: { endpoint: sub.endpoint, createdAt: sub.createdAt } }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = deletePushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: auth.user.id },
  });
  return NextResponse.json({ ok: true });
}
