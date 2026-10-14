import { NextRequest, NextResponse } from 'next/server';
import { passwordVersion, verifyAccessToken } from './auth';
import { prisma } from './prisma';
import { hasPermission, type Role } from './rbac';

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Serialize a user row without sensitive fields.
export function publicUser(user: {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: string;
  isGuest?: boolean;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  passwordHash?: string;
}) {
  const { passwordHash: _omit, ...safe } = user;
  return safe;
}

export function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

type AuthedUser = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;
export type AuthResult =
  | { user: AuthedUser; guestSince: Date | null }
  | { error: NextResponse };

// Validate an access token and load its user. Shared by the Bearer-header
// guard and the SSE route (which receives the token as a query param).
// Tokens issued before the user's last password change are rejected.
export async function authenticateAccessToken(token: string): Promise<AuthResult> {
  try {
    const decoded = verifyAccessToken(token);
    if (decoded.type !== 'access') return { error: jsonError('Invalid token', 401) as NextResponse };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.deletedAt) return { error: jsonError('User not found', 401) as NextResponse };
    if (decoded.pv !== passwordVersion(user.passwordHash)) {
      return { error: jsonError('Session expired, please sign in again', 401) as NextResponse };
    }
    return { user, guestSince: decoded.gs ? new Date(decoded.gs) : null };
  } catch {
    return { error: jsonError('Invalid token', 401) as NextResponse };
  }
}

export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const token = getBearerToken(req);
  if (!token) return { error: jsonError('No token provided', 401) as NextResponse };
  return authenticateAccessToken(token);
}

// A customer owns a booking they made — but a guest-scoped session (returning
// guest identified only by email/phone) owns just the bookings created since
// that session started.
export function ownsBooking(
  auth: { user: { id: string }; guestSince: Date | null },
  booking: { customerId: string; createdAt: Date }
): boolean {
  if (booking.customerId !== auth.user.id) return false;
  return !auth.guestSince || booking.createdAt >= auth.guestSince;
}

// What a guest-scoped session may learn about the account it resumed: nothing
// beyond what the caller typed in themselves.
export function scopedGuestUser(
  user: { id: string; createdAt: Date; updatedAt: Date },
  typed: { firstName?: string; lastName?: string; email?: string | null; phone?: string | null } = {}
) {
  return {
    id: user.id,
    email: typed.email ?? '',
    phone: typed.phone ?? null,
    firstName: typed.firstName ?? 'Guest',
    lastName: typed.lastName ?? '',
    role: 'customer',
    isGuest: true,
    avatarUrl: null,
    emailVerified: false,
    phoneVerified: false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const GUEST_SCOPE_FORBIDDEN =
  'Start a new booking or sign in to manage notifications for this account';

export async function requireRole(req: NextRequest, ...roles: Role[]): Promise<AuthResult> {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth;
  if (!roles.includes(auth.user.role as Role)) {
    return { error: jsonError('Insufficient permissions', 403) as NextResponse };
  }
  return auth;
}

export function requirePermission(role: Role, permission: string): boolean {
  return hasPermission(role, permission);
}

// ---------------------------------------------------------------------------
// Session cookies. The long-lived refresh token never reaches page
// JavaScript: it lives in an httpOnly cookie that is only sent to the auth
// endpoints. The 15-minute access token stays in memory in the page. The
// live-events stream gets its own short-lived cookie because EventSource
// cannot send headers (and tokens must not travel in URLs).
// SameSite=Strict keeps every cookie off cross-site requests (no CSRF).

export const REFRESH_COOKIE = 'bh_refresh';
export const EVENTS_COOKIE = 'bh_events';
// Not a credential: a readable "this browser has a session" flag, so pages
// skip the refresh round-trip for anonymous visitors.
export const SESSION_HINT_COOKIE = 'bh_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const REFRESH_COOKIE_PATH = '/api/v1/auth';
const EVENTS_COOKIE_PATH = '/api/v1/events';

function cookieBase(path: string, maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path,
    maxAge,
  };
}

export function setRefreshCookie(res: NextResponse, refreshToken: string) {
  res.cookies.set(REFRESH_COOKIE, refreshToken, cookieBase(REFRESH_COOKIE_PATH, SESSION_MAX_AGE));
  res.cookies.set(SESSION_HINT_COOKIE, '1', { ...cookieBase('/', SESSION_MAX_AGE), httpOnly: false });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export function clearRefreshCookie(res: NextResponse) {
  res.cookies.set(REFRESH_COOKIE, '', cookieBase(REFRESH_COOKIE_PATH, 0));
  res.cookies.set(SESSION_HINT_COOKIE, '', { ...cookieBase('/', 0), httpOnly: false });
  res.cookies.set(EVENTS_COOKIE, '', cookieBase(EVENTS_COOKIE_PATH, 0));
  return res;
}

export function setEventsCookie(res: NextResponse, accessToken: string) {
  res.cookies.set(EVENTS_COOKIE, accessToken, cookieBase(EVENTS_COOKIE_PATH, 15 * 60));
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

// Response for login/register/guest: the access token in the body, the
// refresh token only as a cookie.
export function sessionResponse(
  user: unknown,
  tokens: { accessToken: string; refreshToken: string },
  status = 200
) {
  const res = NextResponse.json({ user, accessToken: tokens.accessToken }, { status });
  return setRefreshCookie(res, tokens.refreshToken);
}
