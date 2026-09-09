import { prisma } from '@/lib/prisma';

export const HOLD_MINUTES = 10;
export const MIN_LEAD_MINUTES = 30;
export const BOOKING_WINDOW_DAYS = 60;
export const SLOT_STEP_MINUTES = 15;

// --- Shop-timezone helpers (no external deps) ---

// UTC offset in minutes for a timezone at a given instant.
export function tzOffsetMinutes(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(at).map((p) => [p.type, p.value])
  );
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUTC - at.getTime()) / 60_000);
}

// Shop-local wall parts for a UTC instant.
export function shopParts(timeZone: string, at: Date): { dow: number; minutes: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = Object.fromEntries(dtf.formatToParts(at).map((p) => [p.type, p.value]));
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  return { dow: dowMap[parts.weekday], minutes: hour * 60 + Number(parts.minute) };
}

// Convert a shop-local wall time (YYYY-MM-DD + minutes since midnight) to UTC.
// Two-pass offset resolution handles DST transitions correctly.
export function wallToUtc(timeZone: string, date: string, minutes: number): Date {
  const [y, m, d] = date.split('-').map(Number);
  const wallAsUtcMs = Date.UTC(y, m - 1, d, 0, 0) + minutes * 60_000;
  const firstPass = wallAsUtcMs - tzOffsetMinutes(timeZone, new Date(wallAsUtcMs)) * 60_000;
  const secondPass = wallAsUtcMs - tzOffsetMinutes(timeZone, new Date(firstPass)) * 60_000;
  return new Date(secondPass);
}

export interface SlotCheck {
  valid: boolean;
  error?: string;
  endTime?: Date;
}

// Minutes since midnight for a @db.Time field (Date or "HH:MM:SS" string).
function timeToMinutes(t: Date | string): number {
  if (typeof t === 'string') {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

async function shopTimezone(shopId: string): Promise<string> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { timezone: true } });
  return shop?.timezone ?? 'UTC';
}

export async function validateSlotAvailability(
  staffId: string,
  serviceId: string,
  shopId: string,
  startTime: Date,
  excludeBookingId?: string
): Promise<SlotCheck> {
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || !staff.isActive || staff.deletedAt || staff.shopId !== shopId) {
    return { valid: false, error: 'Staff not found or inactive' };
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.isActive || service.deletedAt || service.shopId !== shopId) {
    return { valid: false, error: 'Service not found or inactive' };
  }

  const staffService = await prisma.staffService.findUnique({
    where: { staffId_serviceId: { staffId, serviceId } },
  });
  if (!staffService) {
    return { valid: false, error: 'Staff does not offer this service' };
  }

  const duration = staffService.customDurationMinutes ?? service.durationMinutes;
  const endTime = new Date(startTime.getTime() + (duration + service.bufferMinutes) * 60_000);

  // Booking window + lead time
  const now = new Date();
  if (startTime < new Date(now.getTime() + MIN_LEAD_MINUTES * 60_000)) {
    return { valid: false, error: 'Booking must be at least 30 minutes in advance' };
  }
  if (startTime > new Date(now.getTime() + BOOKING_WINDOW_DAYS * 24 * 60 * 60_000)) {
    return { valid: false, error: 'Booking window is 60 days in advance' };
  }

  // Overlapping bookings (expired holds count as free)
  const overlapping = await prisma.booking.findFirst({
    where: {
      staffId,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      NOT: { status: { in: ['cancelled', 'no_show'] } },
      OR: [
        { status: 'confirmed' },
        { status: 'completed' },
        { status: 'pending', OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }] },
      ],
      startAt: { lt: endTime },
      endAt: { gt: startTime },
    },
  });
  if (overlapping) {
    return { valid: false, error: 'Time slot is no longer available' };
  }

  // Working hours in the shop's local time
  const timeZone = await shopTimezone(shopId);
  const local = shopParts(timeZone, startTime);
  const endLocal = shopParts(timeZone, endTime);
  const availabilities = await prisma.availability.findMany({
    where: { staffId, dayOfWeek: local.dow, isActive: true },
  });
  const withinHours = availabilities.some(
    (a) => timeToMinutes(a.startTime) <= local.minutes && timeToMinutes(a.endTime) >= endLocal.minutes
  );
  if (!withinHours) {
    return { valid: false, error: 'Staff not available at this time' };
  }

  // Time off
  const timeOff = await prisma.timeOff.findFirst({
    where: {
      staffId,
      status: 'approved',
      startAt: { lte: endTime },
      endAt: { gte: startTime },
    },
  });
  if (timeOff) {
    return { valid: false, error: 'Staff has time off during this period' };
  }

  return { valid: true, endTime };
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

// Generate slots for a shop-local date (YYYY-MM-DD in the shop's timezone),
// stepping every SLOT_STEP_MINUTES within the staff member's working hours.
// Returned ISO strings are UTC; display them with the shop's timezone.
export async function getAvailableSlots(
  staffId: string,
  serviceId: string,
  shopId: string,
  date: string
): Promise<{ slots: TimeSlot[]; timeZone: string }> {
  const timeZone = await shopTimezone(shopId);
  const staffService = await prisma.staffService.findUnique({
    where: { staffId_serviceId: { staffId, serviceId } },
    include: { service: true },
  });
  if (!staffService) return { slots: [], timeZone };
  const service = staffService.service;
  if (!service.isActive) return { slots: [], timeZone };

  const duration = staffService.customDurationMinutes ?? service.durationMinutes;
  const totalMinutes = duration + service.bufferMinutes;

  const dayOfWeek = shopParts(timeZone, wallToUtc(timeZone, date, 720)).dow;
  const availabilities = await prisma.availability.findMany({
    where: { staffId, dayOfWeek, isActive: true },
    orderBy: { startTime: 'asc' },
  });
  if (availabilities.length === 0) return { slots: [], timeZone };

  const now = new Date();
  const slots: TimeSlot[] = [];

  // Bulk inputs (one round of queries, not one per slot).
  const dayStartUtc = wallToUtc(timeZone, date, 0);
  const dayEndUtc = wallToUtc(timeZone, date, 1440);
  const dayBookings = await prisma.booking.findMany({
    where: {
      staffId,
      NOT: { status: { in: ['cancelled', 'no_show'] } },
      startAt: { lt: dayEndUtc },
      endAt: { gt: dayStartUtc },
    },
    select: { startAt: true, endAt: true, status: true, holdExpiresAt: true },
  });
  const blocking = dayBookings.filter(
    (b) =>
      b.status === 'confirmed' ||
      b.status === 'completed' ||
      (b.status === 'pending' && (b.holdExpiresAt === null || b.holdExpiresAt > now))
  );
  const dayOff = await prisma.timeOff.findMany({
    where: { staffId, status: 'approved', startAt: { lt: dayEndUtc }, endAt: { gt: dayStartUtc } },
    select: { startAt: true, endAt: true },
  });
  const leadCutoff = new Date(now.getTime() + MIN_LEAD_MINUTES * 60_000);

  for (const a of availabilities) {
    const windowStart = timeToMinutes(a.startTime);
    const windowEnd = timeToMinutes(a.endTime);
    for (let m = windowStart; m + totalMinutes <= windowEnd; m += SLOT_STEP_MINUTES) {
      const start = wallToUtc(timeZone, date, m);
      const end = new Date(start.getTime() + totalMinutes * 60_000);
      const overlapsBooking = blocking.some((b) => b.startAt < end && b.endAt > start);
      const overlapsOff = dayOff.some((t) => t.startAt < end && t.endAt > start);
      slots.push({
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        available: start >= leadCutoff && !overlapsBooking && !overlapsOff,
      });
    }
  }
  return { slots, timeZone };
}

// Can this user act on this booking? Owner, assigned staff, or shop admin.
export async function canActOnBooking(
  userId: string,
  userRole: string,
  booking: { customerId: string; staffId: string; shopId: string }
): Promise<boolean> {
  if (booking.customerId === userId) return true;
  if (userRole === 'super_admin') return true;
  const staffProfile = await prisma.staff.findFirst({
    where: { userId, shopId: booking.shopId, deletedAt: null },
    include: { user: true },
  });
  if (!staffProfile) return false;
  if (staffProfile.id === booking.staffId) return true; // assigned staff
  if (userRole === 'admin') return true; // shop admin (must be staff of shop)
  return staffProfile.user.role === 'admin';
}
