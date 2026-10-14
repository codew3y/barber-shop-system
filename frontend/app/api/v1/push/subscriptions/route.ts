import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@barberhouse/backend/lib/prisma';
import { requireAuth, jsonError, GUEST_SCOPE_FORBIDDEN } from '@barberhouse/backend/lib/api';
import {
  deletePushSubscriptionSchema,
  upsertPushSubscriptionSchema,
} from '@barberhouse/backend/schemas/notifications';

// Browser push subscriptions (Phase 4.3). Endpoints are opaque bearer
// URLs — a user may only touch their own rows, matched by userId.
// Guest-scoped sessions can't list or add devices: subscribing a new browser
// to a resumed account would forward that account's booking alerts to it.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  if (auth.guestSince) return NextResponse.json({ subscriptions: [] });
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
  if (auth.guestSince) return jsonError(GUEST_SCOPE_FORBIDDEN, 403);
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
