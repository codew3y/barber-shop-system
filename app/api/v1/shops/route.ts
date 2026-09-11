import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { shopListQuerySchema } from '@/schemas/booking';

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, 'shops-list', 100, 60_000);
  if (limited) return limited;

  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = shopListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { city, state, page, limit } = parsed.data;

  const where = {
    isActive: true,
    deletedAt: null,
    ...(city ? { city: { contains: city, mode: 'insensitive' as const } } : {}),
    ...(state ? { state: { contains: state, mode: 'insensitive' as const } } : {}),
  };
  const [total, shops] = await Promise.all([
    prisma.shop.count({ where }),
    prisma.shop.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
    }),
  ]);
  return NextResponse.json({ shops, pagination: { page, limit, total } });
}
