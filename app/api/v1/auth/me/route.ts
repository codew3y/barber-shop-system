import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, publicUser } from '@/lib/api';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  return NextResponse.json({ user: publicUser(auth.user) });
}
