import { prisma } from '@/lib/prisma';

export const HOLD_MINUTES = 10;
export const MIN_LEAD_MINUTES = 30;
export const BOOKING_WINDOW_DAYS = 60;
export const SLOT_STEP_MINUTES = 15;

export interface SlotCheck {
  valid: boolean;
  error?: string;
  endTime?: Date;
}

// Minutes since midnight (UTC) for a @db.Time field read as Date.
function timeToMinutes(t: Date): number {
  return t.getUTCHours() * 60 + t.getUTCMinutes();
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

  // Working hours (day of week from UTC date)
  const dayOfWeek = startTime.getUTCDay();
  const availabilities = await prisma.availability.findMany({
    where: { staffId, dayOfWeek, isActive: true },
  });
  const startMin = startTime.getUTCHours() * 60 + startTime.getUTCMinutes();
  const endMin = endTime.getUTCHours() * 60 + endTime.getUTCMinutes();
  const withinHours = availabilities.some(
    (a) => timeToMinutes(a.startTime) <= startMin && timeToMinutes(a.endTime) >= endMin
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

// Generate slots for a shop-local date (YYYY-MM-DD, interpreted as UTC day)
// stepping every SLOT_STEP_MINUTES within the staff member's working hours.
export async function getAvailableSlots(
  staffId: string,
  serviceId: string,
  shopId: string,
  date: string
): Promise<TimeSlot[]> {
  const staffService = await prisma.staffService.findUnique({
    where: { staffId_serviceId: { staffId, serviceId } },
    include: { service: true },
  });
  if (!staffService) return [];
  const service = staffService.service;
  if (!service.isActive) return [];

  const duration = staffService.customDurationMinutes ?? service.durationMinutes;
  const totalMinutes = duration + service.bufferMinutes;

  const day = new Date(`${date}T00:00:00Z`);
  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
  const availabilities = await prisma.availability.findMany({
    where: { staffId, dayOfWeek, isActive: true },
    orderBy: { startTime: 'asc' },
  });
  if (availabilities.length === 0) return [];

  const now = new Date();
  const slots: TimeSlot[] = [];
  for (const a of availabilities) {
    const windowStart = timeToMinutes(a.startTime);
    const windowEnd = timeToMinutes(a.endTime);
    for (let m = windowStart; m + totalMinutes <= windowEnd; m += SLOT_STEP_MINUTES) {
      const start = new Date(day.getTime() + m * 60_000);
      const end = new Date(start.getTime() + totalMinutes * 60_000);
      let available = true;
      if (start < new Date(now.getTime() + MIN_LEAD_MINUTES * 60_000)) {
        available = false;
      } else {
        const check = await validateSlotAvailability(staffId, serviceId, shopId, start);
        available = check.valid;
      }
      slots.push({ startTime: start.toISOString(), endTime: end.toISOString(), available });
    }
  }
  return slots;
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
