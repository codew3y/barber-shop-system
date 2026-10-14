import { NextRequest, NextResponse } from 'next/server';
import { rotateRefreshToken } from '@barberhouse/backend/lib/auth';
import { jsonError } from '@barberhouse/backend/lib/api';
import { rateLimit } from '@barberhouse/backend/lib/rate-limit';
import { RedisUnavailableError } from '@barberhouse/backend/lib/redis';
import { refreshSchema } from '@barberhouse/backend/schemas/auth';

export async function POST(req: NextRequest) {
  // Generous: every open tab refreshes every 15 minutes.
  const limited = await rateLimit(req, 'auth-refresh', 30, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const tokens = await rotateRefreshToken(parsed.data.refreshToken);
    return NextResponse.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err) {
    // Reuse detection depends on Redis. If Redis is configured but down we
    // cannot tell a fresh token from a replayed one, so refuse — but say so
    // with a 503 so it is not mistaken for an invalid token (and so the
    // client retries instead of logging the user out).
    if (err instanceof RedisUnavailableError) {
      return jsonError('Session service temporarily unavailable — please try again', 503);
    }
    const message = err instanceof Error ? err.message : 'Invalid refresh token';
    const status = message === 'Refresh token reuse detected' ? 403 : 401;
    return jsonError(message, status);
  }
}
