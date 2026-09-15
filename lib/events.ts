import { EventEmitter } from 'events';
import { redis, redisConfigured } from './redis';

// Live booking-event bus (Phase 4.3). Publishers (booking mutations, jobs)
// call `emitShopEvent`; the SSE route subscribes. Transport is Redis
// pub/sub when configured (works across serverless instances and the
// separate jobs process); otherwise an in-process emitter so local dev
// and keyless CI still get live updates on a single instance.

export type ShopEventType =
  | 'booking.created'
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'booking.rescheduled'
  | 'booking.status'
  | 'booking.no_show';

export interface ShopEvent {
  id: string;
  type: ShopEventType;
  shopId: string;
  bookingId: string;
  customerId?: string;
  staffId?: string;
  status?: string;
  at: string;
}

const CHANNEL = 'barberhouse:events';
const local = new EventEmitter();
local.setMaxListeners(100);

type Handler = (event: ShopEvent) => void;
const localHandlers = new Set<Handler>();
let redisSubscriber: ReturnType<typeof createSubscriber> | null = null;
let redisSubscribed = false;

function createSubscriber() {
  return redis.duplicate();
}

async function ensureRedisSubscription(): Promise<void> {
  if (redisSubscribed || !redisConfigured) return;
  try {
    redisSubscriber = createSubscriber();
    redisSubscriber.on('error', () => {
      // Fall through to local delivery; the error is already logged
      // by the shared client handler pattern.
    });
    redisSubscriber.on('message', (_channel: string, raw: string) => {
      try {
        deliver(JSON.parse(raw) as ShopEvent);
      } catch {
        // Ignore malformed payloads.
      }
    });
    await redisSubscriber.subscribe(CHANNEL);
    redisSubscribed = true;
  } catch (err) {
    console.error('[events] redis subscribe failed, using local bus', err);
    redisSubscriber = null;
  }
}

// Fire-and-forget from mutation sites. Never throws — events must not
// break the booking flow.
export function emitShopEvent(event: Omit<ShopEvent, 'id' | 'at'>): void {
  const full: ShopEvent = {
    ...event,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    at: new Date().toISOString(),
  };
  deliver(full);
  if (redisConfigured) {
    redis.publish(CHANNEL, JSON.stringify(full)).catch((err) => {
      console.error('[events] redis publish failed', err);
    });
  }
}

// Seen-ids guard: with Redis, the publishing instance also receives its
// own message back through the subscription — skip the duplicate.
const seen = new Set<string>();

function deliver(event: ShopEvent): void {
  if (seen.has(event.id)) return;
  seen.add(event.id);
  if (seen.size > 1000) {
    const oldest = seen.values().next();
    if (!oldest.done) seen.delete(oldest.value);
  }
  for (const h of localHandlers) {
    try {
      h(event);
    } catch (err) {
      console.error('[events] local handler failed', err);
    }
  }
}

export async function subscribeShopEvents(handler: Handler): Promise<() => void> {
  localHandlers.add(handler);
  if (redisConfigured) {
    await ensureRedisSubscription();
  }
  return () => {
    localHandlers.delete(handler);
  };
}
