import { describe, expect, it } from 'vitest';
import { isJobRequestAuthorized } from './job-auth';

const base = {
  internalKey: undefined as string | undefined,
  cronSecret: undefined as string | undefined,
  headerInternalKey: null as string | null,
  headerAuthorization: null as string | null,
  isProduction: false,
};

describe('job trigger authorization', () => {
  it('accepts the internal key from an external scheduler', () => {
    expect(isJobRequestAuthorized({ ...base, internalKey: 'k', headerInternalKey: 'k' })).toEqual({
      ok: true,
    });
  });

  it('accepts the Vercel Cron bearer token', () => {
    expect(
      isJobRequestAuthorized({ ...base, cronSecret: 's', headerAuthorization: 'Bearer s' })
    ).toEqual({ ok: true });
  });

  it('rejects a wrong or missing credential when one is configured', () => {
    expect(
      isJobRequestAuthorized({ ...base, internalKey: 'k', headerInternalKey: 'nope' })
    ).toEqual({ ok: false, status: 401 });
    expect(isJobRequestAuthorized({ ...base, internalKey: 'k' })).toEqual({
      ok: false,
      status: 401,
    });
    expect(
      isJobRequestAuthorized({ ...base, cronSecret: 's', headerAuthorization: 'Bearer wrong' })
    ).toEqual({ ok: false, status: 401 });
  });

  it('does not let the internal key be passed as a bearer token', () => {
    expect(
      isJobRequestAuthorized({ ...base, internalKey: 'k', headerAuthorization: 'Bearer k' })
    ).toEqual({ ok: false, status: 401 });
  });

  it('refuses in production when nothing is configured', () => {
    expect(isJobRequestAuthorized({ ...base, isProduction: true })).toEqual({
      ok: false,
      status: 503,
    });
  });

  it('allows an unconfigured non-production environment', () => {
    expect(isJobRequestAuthorized(base)).toEqual({ ok: true });
  });
});
