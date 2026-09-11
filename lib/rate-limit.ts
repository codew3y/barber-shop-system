import { NextRequest, NextResponse } from 'next/server';
import { redis, redisConfigured } from './redis';

/**
 * Fixed-window rate limiter.
 *
 * Backed by Redis so the window is shared across serverless instances — an
 * in-memory Map gives each instance its own counter, which on Vercel means
 * the effective limit is (instances x max) and brute-force protection is
 * whatever the load balancer happens to do. The Map is kept only as a
 * fallback for environments with no Redis (local dev, CI).
 */
const memory = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

function tooMany(): NextResponse {
  return NextResponse.json({ error: 'Too many requests, please try again later' }, { status: 429 });
}

function memoryLimit(mapKey: string, max: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  const entry = memory.get(mapKey);
  if (!entry || now > entry.resetAt) {
    memory.set(mapKey, { count: 1, resetAt: now + windowMs });
    return null;
  }
  entry.count += 1;
  return entry.count > max ? tooMany() : null;
}

export async function rateLimit(
  req: NextRequest,
  key: string,
  max: number,
  windowMs: number
): Promise<NextResponse | null> {
  const mapKey = `ratelimit:${key}:${clientIp(req)}`;

  if (!redisConfigured) return memoryLimit(mapKey, max, windowMs);

  try {
    // INCR then EXPIRE on first hit: one shared fixed window per key.
    const count = await redis.incr(mapKey);
    if (count === 1) await redis.pexpire(mapKey, windowMs);
    return count > max ? tooMany() : null;
  } catch (err) {
    // Rate limiting is a availability guard, not an authorization decision.
    // Failing closed here would take the whole API down with Redis, so fall
    // back to the per-instance window and make the degradation visible.
    console.error('[rate-limit] Redis unavailable, falling back to in-memory window', err);
    return memoryLimit(mapKey, max, windowMs);
  }
}
