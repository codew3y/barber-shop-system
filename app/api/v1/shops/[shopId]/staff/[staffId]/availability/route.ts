import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api';
import { getAvailableSlots } from '@/services/bookingService';
import { availabilityQuerySchema } from '@/schemas/booking';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string; staffId: string }> }
) {
  const { shopId, staffId } = await params;
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = availabilityQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, shopId, isActive: true, deletedAt: null },
  });
  if (!staff) return jsonError('Staff not found', 404);

  const slots = await getAvailableSlots(staffId, parsed.data.serviceId, shopId, parsed.data.date);
  return NextResponse.json({ slots });
}
