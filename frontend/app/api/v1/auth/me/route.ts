import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, publicUser, scopedGuestUser } from '@barberhouse/backend/lib/api';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  // A guest-scoped session never sees the stored profile of the account it
  // resumed (it was reached by email/phone alone).
  const user = auth.guestSince ? scopedGuestUser(auth.user) : publicUser(auth.user);
  return NextResponse.json({ user });
}
