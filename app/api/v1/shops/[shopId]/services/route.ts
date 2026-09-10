import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api';
import { priceRange } from '@/lib/format';

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string;
  bufferMinutes: number;
  category: string | null;
  customs: (string | null)[] | null;
}

// Single roundtrip instead of Prisma's per-relation hops.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const shop = await prisma.shop.findFirst({ where: { id: shopId, deletedAt: null }, select: { id: true } });
  if (!shop) return jsonError('Shop not found', 404);
  const rows = await prisma.$queryRaw<ServiceRow[]>`
    SELECT sv.id::text AS id, sv.name, sv.description,
      sv.duration_minutes AS "durationMinutes", sv.price::text AS price,
      sv.buffer_minutes AS "bufferMinutes", sv.category,
      COALESCE(json_agg(ss.custom_price) FILTER (WHERE ss.staff_id IS NOT NULL), '[]') AS customs
    FROM services sv
    LEFT JOIN staff_services ss ON ss.service_id = sv.id
    WHERE sv.shop_id = ${shopId}::uuid AND sv.is_active AND sv.deleted_at IS NULL
    GROUP BY sv.id ORDER BY sv.name`;
  return NextResponse.json({
    services: rows.map((s) => {
      const customs = (s.customs ?? []).map((c) => (c ? Number(c) : null));
      const values = [Number(s.price), ...customs.filter((c) => c != null)];
      return {
        ...s,
        durationMinutes: Number(s.durationMinutes),
        bufferMinutes: Number(s.bufferMinutes),
        priceRange: priceRange(Number(s.price), customs),
        minPrice: Math.min(...values),
        maxPrice: Math.max(...values),
      };
    }),
  });
}
