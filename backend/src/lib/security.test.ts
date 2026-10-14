import { createHmac } from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  generatePasswordResetToken,
  generateTokens,
  passwordVersion,
  refreshReuseAllowed,
  REFRESH_REUSE_GRACE_MS,
  verifyAccessToken,
  verifyPasswordResetToken,
  verifyRefreshToken,
} from './auth';
import { ownsBooking, scopedGuestUser } from './api';
import { isJobRequestAuthorized } from './job-auth';
import { verifyWebhookSignature, WEBHOOK_TOLERANCE_SECONDS } from './paymongo';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.PAYMONGO_WEBHOOK_SECRET = 'whsk_test';
});

const user = { id: '00000000-0000-4000-8000-000000000001', passwordHash: '$2b$12$abc' };

describe('session tokens', () => {
  it('bind the password version and carry no guest scope by default', () => {
    const { accessToken, refreshToken } = generateTokens(user);
    const access = verifyAccessToken(accessToken);
    expect(access.pv).toBe(passwordVersion(user.passwordHash));
    expect(access.gs).toBeUndefined();
    expect(verifyRefreshToken(refreshToken).pv).toBe(access.pv);
  });

  it('carry the guest scope on both tokens when resuming a guest account', () => {
    const since = new Date('2026-10-15T00:00:00Z');
    const { accessToken, refreshToken } = generateTokens(user, { guestSince: since });
    expect(verifyAccessToken(accessToken).gs).toBe(since.getTime());
    expect(verifyRefreshToken(refreshToken).gs).toBe(since.getTime());
  });

  it('start a new session family per sign-in and keep it through rotation', () => {
    const a = verifyRefreshToken(generateTokens(user).refreshToken);
    const b = verifyRefreshToken(generateTokens(user).refreshToken);
    expect(a.fid).toBeTruthy();
    expect(a.fid).not.toBe(b.fid);
    const rotated = verifyRefreshToken(generateTokens(user, { family: a.fid }).refreshToken);
    expect(rotated.fid).toBe(a.fid);
    expect(rotated.jti).not.toBe(a.jti);
  });

  it('change version when the password changes', () => {
    expect(passwordVersion('$2b$12$abc')).not.toBe(passwordVersion('$2b$12$xyz'));
  });

  it('bind reset tokens to the password they were issued against', () => {
    const token = generatePasswordResetToken(user);
    expect(verifyPasswordResetToken(token).pv).toBe(passwordVersion(user.passwordHash));
    const { accessToken } = generateTokens(user);
    expect(() => verifyPasswordResetToken(accessToken)).toThrow();
  });
});

describe('refresh-token reuse window', () => {
  const now = 1_000_000_000_000;
  it('allows a never-used token', () => expect(refreshReuseAllowed(null, now)).toBe(true));
  it('allows a token rotated moments ago (lost response)', () =>
    expect(refreshReuseAllowed(String(now - 5_000), now)).toBe(true));
  it('refuses reuse after the grace window', () =>
    expect(refreshReuseAllowed(String(now - REFRESH_REUSE_GRACE_MS - 1), now)).toBe(false));
  it('never allows a logged-out (revoked) token', () => expect(refreshReuseAllowed('1', now)).toBe(false));
});

describe('guest-scoped booking ownership', () => {
  const since = new Date('2026-10-15T10:00:00Z');
  const before = { customerId: user.id, createdAt: new Date('2026-10-01T00:00:00Z') };
  const after = { customerId: user.id, createdAt: new Date('2026-10-15T10:05:00Z') };

  it('lets a normal session reach all of its own bookings', () => {
    const auth = { user, guestSince: null };
    expect(ownsBooking(auth, before)).toBe(true);
    expect(ownsBooking(auth, after)).toBe(true);
  });

  it('limits a guest-scoped session to bookings made since it started', () => {
    const auth = { user, guestSince: since };
    expect(ownsBooking(auth, before)).toBe(false);
    expect(ownsBooking(auth, after)).toBe(true);
  });

  it('never grants another customer’s booking', () => {
    expect(ownsBooking({ user, guestSince: null }, { ...after, customerId: 'someone-else' })).toBe(false);
  });

  it('exposes only what the caller typed, never the stored profile', () => {
    const stored = { id: user.id, createdAt: new Date(), updatedAt: new Date() };
    const shown = scopedGuestUser(stored, { firstName: 'Typed', email: 'typed@example.com' });
    expect(shown).toMatchObject({ firstName: 'Typed', email: 'typed@example.com', phone: null, isGuest: true });
    expect(scopedGuestUser(stored)).toMatchObject({ firstName: 'Guest', email: '', phone: null });
  });
});

describe('PayMongo webhook signature', () => {
  const body = JSON.stringify({ data: { attributes: { type: 'payment.paid', data: { id: 'pay_1', attributes: {} } } } });
  const sign = (content: string) => createHmac('sha256', 'whsk_test').update(content).digest('hex');
  const now = Date.UTC(2026, 9, 15, 12, 0, 0);
  const t = Math.floor(now / 1000);

  it('accepts a fresh timestamped signature', () => {
    expect(verifyWebhookSignature(body, `t=${t},te=${sign(`${t}.${body}`)},li=`, now).type).toBe('payment.paid');
  });

  it('rejects a replay outside the tolerance window', () => {
    const old = t - WEBHOOK_TOLERANCE_SECONDS - 1;
    expect(() => verifyWebhookSignature(body, `t=${old},te=${sign(`${old}.${body}`)}`, now)).toThrow(/tolerance/);
  });

  it('rejects a body-only signature when a timestamp is present', () => {
    expect(() => verifyWebhookSignature(body, `t=${t},te=${sign(body)}`, now)).toThrow(/signature/);
  });

  it('still accepts the legacy bare signature (no timestamp)', () => {
    expect(verifyWebhookSignature(body, sign(body), now).type).toBe('payment.paid');
  });
});

describe('job trigger secret comparison', () => {
  const base = { cronSecret: undefined, headerAuthorization: null, isProduction: true };
  it('accepts the exact key and rejects near misses of any length', () => {
    expect(isJobRequestAuthorized({ ...base, internalKey: 'k3y', headerInternalKey: 'k3y' })).toEqual({ ok: true });
    for (const wrong of ['k3', 'k3y!', 'K3Y', '']) {
      expect(isJobRequestAuthorized({ ...base, internalKey: 'k3y', headerInternalKey: wrong })).toEqual({
        ok: false,
        status: 401,
      });
    }
  });
});
