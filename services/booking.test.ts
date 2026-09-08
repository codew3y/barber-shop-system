import { describe, it, expect } from 'vitest';
import {
  createBookingSchema,
  cancelBookingSchema,
  rescheduleBookingSchema,
  availabilityQuerySchema,
} from '../schemas/booking';

const ids = {
  shopId: 'ab94ec81-f4e4-4b1f-8395-7f22a2749dc3',
  staffId: '91f63384-a8e1-4c45-bf76-d8dcb3090190',
  serviceId: 'd573c0f8-1f5f-439f-971d-ca7c67a2e91f',
};

describe('booking schemas', () => {
  it('accepts a valid booking payload', () => {
    expect(
      createBookingSchema.safeParse({ ...ids, startTime: '2026-09-09T09:00:00Z' }).success
    ).toBe(true);
  });

  it('rejects non-UUID ids and bad datetimes', () => {
    expect(
      createBookingSchema.safeParse({ ...ids, staffId: 'nope', startTime: '2026-09-09' }).success
    ).toBe(false);
  });

  it('allows empty cancel reason', () => {
    expect(cancelBookingSchema.safeParse({}).success).toBe(true);
  });

  it('requires newStartTime for reschedule', () => {
    expect(rescheduleBookingSchema.safeParse({}).success).toBe(false);
    expect(
      rescheduleBookingSchema.safeParse({ newStartTime: '2026-09-09T10:00:00Z' }).success
    ).toBe(true);
  });

  it('validates availability query date format', () => {
    expect(
      availabilityQuerySchema.safeParse({ date: '09-09-2026', serviceId: ids.serviceId }).success
    ).toBe(false);
    expect(
      availabilityQuerySchema.safeParse({ date: '2026-09-09', serviceId: ids.serviceId }).success
    ).toBe(true);
  });
});
