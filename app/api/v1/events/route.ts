import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { subscribeShopEvents, type ShopEvent } from '@/lib/events';

export const runtime = 'nodejs';
// EventSource reconnects on its own; give proxies room to buffer.
export const dynamic = 'force-dynamic';

// Live shop events over Server-Sent Events (Phase 4.3). EventSource
// cannot set headers, so the access token travels as `?token=` and is
// validated once at connect time (15-min TTL bounds the exposure).
// Staff/admin receive shop-scoped events; customers only their own.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 401 });
  }
  let userId: string;
  let role: string;
  try {
    const decoded = verifyAccessToken(token);
    if (decoded.type !== 'access') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }
    userId = user.id;
    role = user.role;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  let shopIds: Set<string> | null = null; // null = all shops (admin)
  if (role === 'staff') {
    const profiles = await prisma.staff.findMany({
      where: { userId, isActive: true, deletedAt: null },
      select: { shopId: true },
    });
    shopIds = new Set(profiles.map((p) => p.shopId));
  }

  const visible = (e: ShopEvent): boolean => {
    if (role === 'admin' || role === 'super_admin') return true;
    if (role === 'staff') return shopIds!.has(e.shopId);
    return e.customerId === userId;
  };

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const cleanup = () => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    if (unsubscribe) {
      const fn = unsubscribe;
      unsubscribe = null;
      fn();
    }
  };
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          cleanup();
        }
      };
      send(`: connected\n\n`);
      unsubscribe = await subscribeShopEvents((event) => {
        if (visible(event)) send(`data: ${JSON.stringify(event)}\n\n`);
      });
      heartbeat = setInterval(() => send(`: ping\n\n`), 25_000);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
