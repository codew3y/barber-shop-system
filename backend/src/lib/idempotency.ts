import { NextResponse } from 'next/server';
import { redis, redisConfigured } from './redis';

/**
 * Idempotency store for booking creation.
 *
 * Backed by Redis so a retry that lands on a different serverless instance
 * still replays the original response. With the previous in-memory Map the
 * key was invisible to every other instance, so a double submit fell through
 * to a second insert — the Postgres exclusion constraint caught it, but the
 * customer saw "Time slot is no longer available" for their own booking.
 * The Map is kept as a fallback where Redis is not configured.
 */
interface Entry {
  status: number;
  body: unknown;
  expiresAt: number;
}

const memory = new Map<string, Entry>();
const TTL_MS = 10 * 60_000;

export async function getIdempotentResponse(
  key: string
): Promise<{ status: number; body: unknown } | null> {
  if (redisConfigured) {
    try {
      const raw = await redis.get(`idem:${key}`);
      if (raw) return JSON.parse(raw) as { status: number; body: unknown };
      return null;
    } catch (err) {
      console.error('[idempotency] Redis read failed, falling back to memory', err);
    }
  }
  const entry = memory.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memory.delete(key);
    return null;
  }
  return { status: entry.status, body: entry.body };
}

export async function setIdempotentResponse(key: string, res: NextResponse): Promise<NextResponse> {
  // Read the body off a clone so the original response stays consumable.
  let body: unknown;
  try {
    body = await res.clone().json();
  } catch {
    return res; // booking already created; caching is best effort
  }

  if (redisConfigured) {
    try {
      await redis.set(`idem:${key}`, JSON.stringify({ status: res.status, body }), 'PX', TTL_MS);
      return res;
    } catch (err) {
      console.error('[idempotency] Redis write failed, falling back to memory', err);
    }
  }
  memory.set(key, { status: res.status, body, expiresAt: Date.now() + TTL_MS });
  return res;
}
