import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { blacklistToken, isTokenBlacklisted } from './redis';
import { prisma } from './prisma';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const RESET_TOKEN_EXPIRY = '30m';
const ALGORITHMS: jwt.Algorithm[] = ['HS256'];

// Claims shared by access and refresh tokens.
//  pv — password version: a fingerprint of the password hash at issue time.
//       Changing the password changes it, which ends every existing session
//       and makes a used reset link worthless.
//  gs — guest scope (epoch ms): set when a returning guest resumes an account
//       by email/phone alone. That proves nothing about ownership, so the
//       session only reaches bookings created at or after this instant.
export interface SessionClaims {
  userId: string;
  type: string;
  pv?: string;
  gs?: number;
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

export function generateTokens(user: TokenSubject, opts: { guestSince?: Date } = {}) {
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
    { ...claims, type: 'refresh', jti: randomBytes(16).toString('hex') },
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
  if (await isTokenBlacklisted(decoded.jti)) {
    throw new Error('Refresh token reuse detected');
  }
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, passwordHash: true, deletedAt: true },
  });
  if (!user || user.deletedAt || decoded.pv !== passwordVersion(user.passwordHash)) {
    throw new Error('Invalid refresh token');
  }
  await blacklistToken(decoded.jti, REFRESH_TTL_SECONDS);
  return generateTokens(user, decoded.gs ? { guestSince: new Date(decoded.gs) } : {});
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    const decoded = verifyRefreshToken(refreshToken);
    if (decoded.jti) await blacklistToken(decoded.jti, REFRESH_TTL_SECONDS);
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
