import { describe, it, expect, vi, beforeEach } from 'vitest';
import { channelAllowed, DEFAULT_PREFS } from '@/lib/preferences';
import type { BookingEvent } from '@/services/notificationService';

describe('eventCategory', () => {
  it('maps reminders vs confirmations', async () => {
    const { eventCategory } = await import('@/lib/preferences');
    expect(eventCategory('reminder_24h')).toBe('reminders');
    expect(eventCategory('reminder_1h')).toBe('reminders');
    expect(eventCategory('booking_confirmed')).toBe('confirmations');
    expect(eventCategory('booking_cancelled')).toBe('confirmations');
    expect(eventCategory('booking_rescheduled')).toBe('confirmations');
  });
});

describe('channelAllowed', () => {
  const events: BookingEvent[] = [
    'booking_confirmed',
    'booking_cancelled',
    'booking_rescheduled',
    'reminder_24h',
    'reminder_1h',
  ];
  it('defaults allow everything', () => {
    for (const e of events) {
      expect(channelAllowed(DEFAULT_PREFS, e, 'email')).toBe(true);
      expect(channelAllowed(DEFAULT_PREFS, e, 'push')).toBe(true);
    }
  });
  it('email reminders off blocks only reminder emails', () => {
    const prefs = { ...DEFAULT_PREFS, emailReminders: false };
    expect(channelAllowed(prefs, 'reminder_24h', 'email')).toBe(false);
    expect(channelAllowed(prefs, 'reminder_1h', 'email')).toBe(false);
    expect(channelAllowed(prefs, 'booking_confirmed', 'email')).toBe(true);
    expect(channelAllowed(prefs, 'reminder_24h', 'push')).toBe(true);
  });
  it('push confirmations off blocks only confirmation pushes', () => {
    const prefs = { ...DEFAULT_PREFS, pushConfirmations: false };
    expect(channelAllowed(prefs, 'booking_cancelled', 'push')).toBe(false);
    expect(channelAllowed(prefs, 'reminder_24h', 'push')).toBe(true);
    expect(channelAllowed(prefs, 'booking_cancelled', 'email')).toBe(true);
  });
});

describe('event bus', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('REDIS_URL', '');
  });

  it('delivers once with id and timestamp', async () => {
    const { emitShopEvent, subscribeShopEvents } = await import('@/lib/events');
    const received: unknown[] = [];
    const unsubscribe = await subscribeShopEvents((e) => {
      received.push(e);
    });
    emitShopEvent({ type: 'booking.created', shopId: 'shop-1', bookingId: 'b-1' });
    // Local delivery is synchronous.
    expect(received).toHaveLength(1);
    const first = received[0] as { id: string; at: string; type: string };
    expect(first.type).toBe('booking.created');
    expect(typeof first.id).toBe('string');
    expect(typeof first.at).toBe('string');
    unsubscribe();
  });

  it('unsubscribe stops delivery', async () => {
    const { emitShopEvent, subscribeShopEvents } = await import('@/lib/events');
    const received: unknown[] = [];
    const unsubscribe = await subscribeShopEvents((e) => {
      received.push(e);
    });
    unsubscribe();
    emitShopEvent({ type: 'booking.created', shopId: 'shop-1', bookingId: 'b-1' });
    expect(received).toHaveLength(0);
  });
});
