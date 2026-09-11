import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { blacklistToken, isTokenBlacklisted } from './redis';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const RESET_TOKEN_EXPIRY = '30m';

export function getJwtSecrets() {
  const secret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!secret || !refreshSecret) throw new Error('JWT secrets not configured');
  return { secret, refreshSecret };
}

export function generateTokens(userId: string) {
  const { secret, refreshSecret } = getJwtSecrets();
  const accessToken = jwt.sign({ userId, type: 'access' }, secret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign(
    { userId, type: 'refresh', jti: randomBytes(16).toString('hex') },
    refreshSecret,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string) {
  const { secret } = getJwtSecrets();
  return jwt.verify(token, secret) as { userId: string; type: string };
}

export function verifyRefreshToken(token: string) {
  const { refreshSecret } = getJwtSecrets();
  return jwt.verify(token, refreshSecret) as { userId: string; type: string; jti: string };
}

// Rotate a refresh token: rejects reused/blacklisted tokens, blacklists the
// old jti, and returns a fresh token pair.
export async function rotateRefreshToken(oldRefreshToken: string) {
  const decoded = verifyRefreshToken(oldRefreshToken);
  if (decoded.type !== 'refresh' || !decoded.jti) {
    throw new Error('Invalid refresh token');
  }
  if (await isTokenBlacklisted(decoded.jti)) {
    throw new Error('Refresh token reuse detected');
  }
  await blacklistToken(decoded.jti, REFRESH_TTL_SECONDS);
  return generateTokens(decoded.userId);
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

// Stateless password-reset token (no schema change needed for MVP).
export function generatePasswordResetToken(userId: string): string {
  const { secret } = getJwtSecrets();
  return jwt.sign({ userId, type: 'password_reset' }, secret, {
    expiresIn: RESET_TOKEN_EXPIRY,
  });
}

export function verifyPasswordResetToken(token: string): { userId: string } {
  const { secret } = getJwtSecrets();
  const decoded = jwt.verify(token, secret) as { userId: string; type: string };
  if (decoded.type !== 'password_reset') throw new Error('Invalid reset token');
  return { userId: decoded.userId };
}
