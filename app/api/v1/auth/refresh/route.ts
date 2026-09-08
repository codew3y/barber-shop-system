import { NextRequest, NextResponse } from 'next/server';
import { rotateRefreshToken } from '@/lib/auth';
import { jsonError } from '@/lib/api';
import { refreshSchema } from '@/schemas/auth';

export async function POST(req: NextRequest) {
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
    const message = err instanceof Error ? err.message : 'Invalid refresh token';
    const status = message === 'Refresh token reuse detected' ? 403 : 401;
    return jsonError(message, status);
  }
}
