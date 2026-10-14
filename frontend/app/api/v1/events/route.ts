import { NextRequest, NextResponse } from 'next/server';
import { authenticateAccessToken } from '@barberhouse/backend/lib/api';
import { prisma } from '@barberhouse/backend/lib/prisma';
import { subscribeShopEvents, type ShopEvent } from '@barberhouse/backend/lib/events';

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
  const auth = await authenticateAccessToken(token);
  if ('error' in auth) return auth.error;
  const userId = auth.user.id;
  const role = auth.user.role;
  const guestSince = auth.guestSince;

  let shopIds: Set<string> | null = null; // null = all shops (admin)
  if (role === 'staff') {
    const profiles = await prisma.staff.findMany({
      where: { userId, isActive: true, deletedAt: null },
      select: { shopId: true },
    });
    shopIds = new Set(profiles.map((p) => p.shopId));
  }

  // A guest-scoped session only hears about bookings made since it started;
  // the answer per booking never changes, so cache it for the stream.
  const inScope = new Map<string, boolean>();
  const guestOwns = async (bookingId: string): Promise<boolean> => {
    if (!guestSince) return true;
    let ok = inScope.get(bookingId);
    if (ok === undefined) {
      const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { createdAt: true } });
      ok = !!b && b.createdAt >= guestSince;
      inScope.set(bookingId, ok);
    }
    return ok;
  };

  const visible = async (e: ShopEvent): Promise<boolean> => {
    if (role === 'admin' || role === 'super_admin') return true;
    if (role === 'staff') return shopIds!.has(e.shopId);
    return e.customerId === userId && (await guestOwns(e.bookingId));
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
        void visible(event)
          .then((ok) => {
            if (ok) send(`data: ${JSON.stringify(event)}\n\n`);
          })
          .catch(() => {});
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
