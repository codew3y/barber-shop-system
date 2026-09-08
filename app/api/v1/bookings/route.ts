import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, jsonError } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { getIdempotentResponse, setIdempotentResponse } from '@/lib/idempotency';
import { HOLD_MINUTES, validateSlotAvailability } from '@/services/bookingService';
import { queueBookingNotifications } from '@/services/notificationService';
import { cleanOptional } from '@/lib/sanitize';
import { createBookingSchema } from '@/schemas/booking';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  const limited = rateLimit(req, 'booking-create', 10, 60_000);
  if (limited) return limited;

  const idempotencyKey = req.headers.get('Idempotency-Key');
  if (!idempotencyKey) return jsonError('Idempotency-Key header is required', 400);
  const cacheKey = `${auth.user.id}:${idempotencyKey}`;
  const cached = getIdempotentResponse(cacheKey);
  if (cached) return NextResponse.json(cached.body, { status: cached.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { shopId, staffId, serviceId, startTime, notes } = parsed.data;

  const shop = await prisma.shop.findFirst({ where: { id: shopId, deletedAt: null } });
  if (!shop || !shop.isActive) return jsonError('Shop not found', 404);

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return jsonError('Invalid startTime', 400);

  const check = await validateSlotAvailability(staffId, serviceId, shopId, start);
  if (!check.valid || !check.endTime) {
    return jsonError(check.error ?? 'Slot unavailable', 409);
  }

  try {
    const booking = await prisma.booking.create({
      data: {
        customerId: auth.user.id,
        staffId,
        serviceId,
        shopId,
        startAt: start,
        endAt: check.endTime,
        status: 'pending',
        holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
        notes: cleanOptional(notes, 500),
      },
      include: { service: true, staff: { include: { user: { select: { firstName: true, lastName: true } } } }, shop: true },
    });
    void queueBookingNotifications(booking.id, 'booking_confirmed');
    return setIdempotentResponse(
      cacheKey,
      NextResponse.json({ booking, holdExpiresAt: booking.holdExpiresAt }, { status: 201 })
    );
  } catch (err) {
    // Exclusion-constraint violation (race lost) surfaces as P2002/23xxx
    return jsonError('Time slot is no longer available', 409);
  }
}
