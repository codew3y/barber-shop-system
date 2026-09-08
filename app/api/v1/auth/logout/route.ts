import { NextRequest, NextResponse } from 'next/server';
import { revokeRefreshToken } from '@/lib/auth';
import { requireAuth } from '@/lib/api';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  let refreshToken: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.refreshToken === 'string') refreshToken = body.refreshToken;
  } catch {
    // logout without body is fine — access token is short-lived anyway
  }
  if (refreshToken) await revokeRefreshToken(refreshToken);
  return NextResponse.json({ success: true });
}
