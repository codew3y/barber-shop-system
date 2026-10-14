import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, requireAuth, setEventsCookie } from '@barberhouse/backend/lib/api';

// Hands the live-events stream its credential. EventSource cannot send an
// Authorization header, so the caller's (valid) access token is copied into
// an httpOnly cookie scoped to /api/v1/events — never into the URL, where it
// would land in logs and history.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  return setEventsCookie(NextResponse.json({ ok: true }), getBearerToken(req)!);
}
