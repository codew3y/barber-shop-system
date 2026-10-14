import { NextRequest, NextResponse } from 'next/server';
import { revokeRefreshToken } from '@barberhouse/backend/lib/auth';
import { REFRESH_COOKIE, clearRefreshCookie } from '@barberhouse/backend/lib/api';

// Revokes the session's refresh token and clears the session cookies. Needs
// no access token: holding the refresh token is what lets you end it, and an
// expired access token must not stop anyone from signing out.
export async function POST(req: NextRequest) {
  let refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    try {
      const body = await req.json();
      if (typeof body?.refreshToken === 'string') refreshToken = body.refreshToken;
    } catch {
      // logout without body is fine
    }
  }
  if (refreshToken) await revokeRefreshToken(refreshToken);
  return clearRefreshCookie(NextResponse.json({ success: true }));
}
