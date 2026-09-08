import { describe, it, expect } from 'vitest';
import { hasPermission } from './rbac';
import { registerSchema, loginSchema } from '../schemas/auth';

describe('rbac', () => {
  it('grants customer booking permissions', () => {
    expect(hasPermission('customer', 'bookings:create')).toBe(true);
    expect(hasPermission('customer', 'staff:create')).toBe(false);
  });

  it('grants admin shop permissions', () => {
    expect(hasPermission('admin', 'staff:create')).toBe(true);
    expect(hasPermission('admin', 'bookings:create')).toBe(false);
  });

  it('grants super_admin everything', () => {
    expect(hasPermission('super_admin', 'anything:at:all')).toBe(true);
  });

  it('denies unknown roles', () => {
    expect(hasPermission('nobody' as never, 'bookings:create')).toBe(false);
  });
});

describe('auth schemas', () => {
  it('rejects weak passwords', () => {
    const r = registerSchema.safeParse({
      email: 'a@b.com',
      password: 'short',
      firstName: 'A',
      lastName: 'B',
    });
    expect(r.success).toBe(false);
  });

  it('accepts valid registration', () => {
    const r = registerSchema.safeParse({
      email: 'a@b.com',
      password: 'long-enough-password',
      firstName: 'A',
      lastName: 'B',
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty login password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});
