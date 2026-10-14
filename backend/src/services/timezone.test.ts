import { describe, it, expect } from 'vitest';
import { tzOffsetMinutes, wallToUtc, shopParts } from './bookingService';

const TZ = 'Asia/Manila'; // UTC+8, no DST — deterministic

describe('shop timezone helpers', () => {
  it('resolves Manila offset to +480', () => {
    expect(tzOffsetMinutes(TZ, new Date('2026-09-14T00:00:00Z'))).toBe(480);
  });

  it('converts wall time to UTC', () => {
    // 09:00 Manila = 01:00 UTC
    expect(wallToUtc(TZ, '2026-09-14', 540).toISOString()).toBe('2026-09-14T01:00:00.000Z');
  });

  it('round-trips wall -> UTC -> parts', () => {
    const utc = wallToUtc(TZ, '2026-09-13', 600); // Sunday 10:00 Manila
    const parts = shopParts(TZ, utc);
    expect(parts).toEqual({ dow: 0, minutes: 600 });
  });

  it('never yields 12am slots for 9–18 windows', () => {
    // First slot of a 9:00–18:00 Manila day must read 9 AM in Manila time.
    const first = wallToUtc(TZ, '2026-09-14', 540);
    const label = first.toLocaleTimeString('en-US', { hour: 'numeric', timeZone: TZ });
    expect(label).toBe('9 AM');
  });
});
