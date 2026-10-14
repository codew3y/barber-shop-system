import { NextRequest, NextResponse } from 'next/server';
import { rotateRefreshToken } from '@barberhouse/backend/lib/auth';
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  jsonError,
  setRefreshCookie,
} from '@barberhouse/backend/lib/api';
import { rateLimit } from '@barberhouse/backend/lib/rate-limit';
import { RedisUnavailableError } from '@barberhouse/backend/lib/redis';
import { refreshSchema } from '@barberhouse/backend/schemas/auth';

// Browsers present the refresh token as the httpOnly cookie and get the new
// one back the same way. Non-browser clients (scripts) may still send it in
// the body and receive it in the body.
export async function POST(req: NextRequest) {
  // Generous: every open tab refreshes every 15 minutes.
  const limited = await rateLimit(req, 'auth-refresh', 30, 60_000);
  if (limited) return limited;

  const fromCookie = req.cookies.get(REFRESH_COOKIE)?.value;
  let refreshToken = fromCookie;
  if (!refreshToken) {
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      // No cookie and no body: treated as "not signed in" below.
    }
    const parsed = refreshSchema.safeParse(body);
    if (!parsed.success) return jsonError('Not signed in', 401);
    refreshToken = parsed.data.refreshToken;
  }

  try {
    const tokens = await rotateRefreshToken(refreshToken);
    if (fromCookie) {
      return setRefreshCookie(NextResponse.json({ accessToken: tokens.accessToken }), tokens.refreshToken);
    }
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
    const res = jsonError(message, status);
    // A dead cookie is cleared; on a reuse hit it stays, because another tab
    // may already have rotated it and the browser holds the newer one.
    return fromCookie && status === 401 ? clearRefreshCookie(res) : res;
  }
}
