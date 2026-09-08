import { describe, it, expect } from 'vitest';
import { peso } from '../lib/format';
import { createIntentSchema, refundSchema } from '../schemas/payment';

describe('payments', () => {
  it('formats pesos', () => {
    expect(peso(350)).toBe('₱350.00');
    expect(peso('25.5')).toBe('₱25.50');
  });

  it('requires a booking id for intents', () => {
    expect(createIntentSchema.safeParse({ type: 'deposit' }).success).toBe(false);
    expect(
      createIntentSchema.safeParse({
        bookingId: 'ab94ec81-f4e4-4b1f-8395-7f22a2749dc3',
        type: 'full',
      }).success
    ).toBe(true);
  });

  it('rejects over-zero refund validation only for non-positive amounts', () => {
    expect(refundSchema.safeParse({ amount: -5 }).success).toBe(false);
    expect(refundSchema.safeParse({}).success).toBe(true);
    expect(refundSchema.safeParse({ amount: 100 }).success).toBe(true);
  });
});
