import { NextRequest, NextResponse } from 'next/server';

// Minimal fixed-window in-memory rate limiter for auth endpoints.
// (Phase 6 will move this to Redis-backed limiting per the architecture doc.)
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(req: NextRequest, key: string, max: number, windowMs: number): NextResponse | null {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  const mapKey = `${key}:${ip}`;
  const now = Date.now();
  const entry = hits.get(mapKey);
  if (!entry || now > entry.resetAt) {
    hits.set(mapKey, { count: 1, resetAt: now + windowMs });
    return null;
  }
  entry.count += 1;
  if (entry.count > max) {
    return NextResponse.json(
      { error: 'Too many requests, please try again later' },
      { status: 429 }
    );
  }
  return null;
}
