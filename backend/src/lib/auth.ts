import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { blacklistToken, getBlacklistEntry, isFamilyRevoked, revokeFamily } from './redis';
import { prisma } from './prisma';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const RESET_TOKEN_EXPIRY = '30m';
const ALGORITHMS: jwt.Algorithm[] = ['HS256'];
// A refresh token presented again shortly after it was rotated is the
// browser losing a race (tab closed or connection dropped mid-refresh, so the
// new cookie never landed), not a thief. Allow it briefly; later reuse is
// still refused. Logout revocations get no grace.
export const REFRESH_REUSE_GRACE_MS = 30_000;

export function refreshReuseAllowed(entry: string | null, nowMs: number): boolean {
  if (entry === null) return true; // never used
  const rotatedAt = Number(entry);
  if (entry === '1' || !Number.isFinite(rotatedAt)) return false; // revoked
  return nowMs - rotatedAt <= REFRESH_REUSE_GRACE_MS;
}

// Claims shared by access and refresh tokens.
//  pv — password version: a fingerprint of the password hash at issue time.
//       Changing the password changes it, which ends every existing session
//       and makes a used reset link worthless.
//  fid — session family (refresh tokens only): one id per sign-in, carried
//       through every rotation so the whole chain can be revoked at once.
//  gs — guest scope (epoch ms): set when a returning guest resumes an account
//       by email/phone alone. That proves nothing about ownership, so the
//       session only reaches bookings created at or after this instant.
export interface SessionClaims {
  userId: string;
  type: string;
  pv?: string;
  gs?: number;
  fid?: string;
}

export interface TokenSubject {
  id: string;
  passwordHash: string;
}

export function getJwtSecrets() {
  const secret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!secret || !refreshSecret) throw new Error('JWT secrets not configured');
  return { secret, refreshSecret };
}

export function passwordVersion(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

export function generateTokens(user: TokenSubject, opts: { guestSince?: Date; family?: string } = {}) {
  const { secret, refreshSecret } = getJwtSecrets();
  const claims = {
    userId: user.id,
    pv: passwordVersion(user.passwordHash),
    ...(opts.guestSince ? { gs: opts.guestSince.getTime() } : {}),
  };
  const accessToken = jwt.sign({ ...claims, type: 'access' }, secret, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign(
    {
      ...claims,
      type: 'refresh',
      jti: randomBytes(16).toString('hex'),
      fid: opts.family ?? randomBytes(12).toString('hex'),
    },
    refreshSecret,
    { algorithm: 'HS256', expiresIn: REFRESH_TOKEN_EXPIRY }
  );
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string) {
  const { secret } = getJwtSecrets();
  return jwt.verify(token, secret, { algorithms: ALGORITHMS }) as SessionClaims;
}

export function verifyRefreshToken(token: string) {
  const { refreshSecret } = getJwtSecrets();
  return jwt.verify(token, refreshSecret, { algorithms: ALGORITHMS }) as SessionClaims & {
    jti: string;
  };
}

// Rotate a refresh token: rejects reused/blacklisted tokens and tokens issued
// before the password last changed, blacklists the old jti, and returns a
// fresh pair that keeps any guest scope.
export async function rotateRefreshToken(oldRefreshToken: string) {
  const decoded = verifyRefreshToken(oldRefreshToken);
  if (decoded.type !== 'refresh' || !decoded.jti) {
    throw new Error('Invalid refresh token');
  }
  if (decoded.fid && (await isFamilyRevoked(decoded.fid))) {
    throw new Error('Invalid refresh token');
  }
  const entry = await getBlacklistEntry(decoded.jti);
  if (!refreshReuseAllowed(entry, Date.now())) {
    // Replay outside the grace window: assume the chain leaked and end it,
    // signing out whoever holds the newer tokens too.
    if (decoded.fid) await revokeFamily(decoded.fid, REFRESH_TTL_SECONDS);
    throw new Error('Refresh token reuse detected');
  }
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, passwordHash: true, deletedAt: true },
  });
  if (!user || user.deletedAt || decoded.pv !== passwordVersion(user.passwordHash)) {
    throw new Error('Invalid refresh token');
  }
  // Record the first rotation only, so the grace window can't be extended.
  if (entry === null) await blacklistToken(decoded.jti, REFRESH_TTL_SECONDS, Date.now());
  return generateTokens(user, {
    ...(decoded.gs ? { guestSince: new Date(decoded.gs) } : {}),
    ...(decoded.fid ? { family: decoded.fid } : {}),
  });
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    const decoded = verifyRefreshToken(refreshToken);
    if (decoded.jti) await blacklistToken(decoded.jti, REFRESH_TTL_SECONDS);
    // Ends the whole sign-in, including tokens rotated moments ago.
    if (decoded.fid) await revokeFamily(decoded.fid, REFRESH_TTL_SECONDS);
  } catch {
    // Best effort: an invalid token or a Redis outage must not stop someone
    // logging out. The client discards its tokens either way.
  }
}

// Stateless password-reset token (no schema change needed for MVP). Bound to
// the current password version, so it stops working once it has been used.
export function generatePasswordResetToken(user: TokenSubject): string {
  const { secret } = getJwtSecrets();
  return jwt.sign(
    { userId: user.id, type: 'password_reset', pv: passwordVersion(user.passwordHash) },
    secret,
    { algorithm: 'HS256', expiresIn: RESET_TOKEN_EXPIRY }
  );
}

export function verifyPasswordResetToken(token: string): { userId: string; pv: string } {
  const { secret } = getJwtSecrets();
  const decoded = jwt.verify(token, secret, { algorithms: ALGORITHMS }) as SessionClaims;
  if (decoded.type !== 'password_reset' || !decoded.pv) throw new Error('Invalid reset token');
  return { userId: decoded.userId, pv: decoded.pv };
}
