import { describe, it, expect } from 'vitest';

describe('guest email guard', () => {
  it('detects synthetic guest addresses', async () => {
    const { isGuestEmail } = await import('./notificationService');
    expect(isGuestEmail('guest.15559922633@barberhouse.local')).toBe(true);
    expect(isGuestEmail('Guest.123@BarberHouse.Local')).toBe(true);
    expect(isGuestEmail('real@example.com')).toBe(false);
  });
});
