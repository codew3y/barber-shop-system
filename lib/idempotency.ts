import { NextResponse } from 'next/server';

// Minimal in-memory idempotency store for booking creation.
// (Phase 6 will move this to Redis so it survives restarts / scales.)
interface Entry {
  status: number;
  body: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();
const TTL_MS = 10 * 60_000;

export function getIdempotentResponse(key: string): { status: number; body: unknown } | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return { status: entry.status, body: entry.body };
}

export function setIdempotentResponse(key: string, res: NextResponse): NextResponse {
  try {
    const clone = res.clone();
    void clone.json().then((body) => {
      store.set(key, { status: res.status, body, expiresAt: Date.now() + TTL_MS });
    });
  } catch {
    // best effort — booking already created, just skip caching
  }
  return res;
}
