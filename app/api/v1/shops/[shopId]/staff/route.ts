import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api';

interface StaffRow {
  id: string;
  title: string | null;
  bio: string | null;
  specialties: string[];
  user: { firstName: string; lastName: string; avatarUrl: string | null };
  services: { customPrice: string | null; service: { id: string; name: string } }[];
}

// Single roundtrip instead of Prisma's per-relation hops.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const shop = await prisma.shop.findFirst({ where: { id: shopId, deletedAt: null }, select: { id: true } });
  if (!shop) return jsonError('Shop not found', 404);
  const staff = await prisma.$queryRaw<StaffRow[]>`
    SELECT st.id::text AS id, st.title, st.bio, st.specialties,
      json_build_object(
        'firstName', u.first_name, 'lastName', u.last_name, 'avatarUrl', u.avatar_url
      ) AS "user",
      COALESCE(json_agg(json_build_object(
        'customPrice', ss.custom_price,
        'service', json_build_object('id', sv.id, 'name', sv.name)
      ) ORDER BY sv.name) FILTER (WHERE ss.staff_id IS NOT NULL), '[]') AS services
    FROM staff st
    JOIN users u ON u.id = st.user_id
    LEFT JOIN staff_services ss ON ss.staff_id = st.id
    LEFT JOIN services sv ON sv.id = ss.service_id
    WHERE st.shop_id = ${shopId}::uuid AND st.is_active AND st.deleted_at IS NULL
    GROUP BY st.id, u.first_name, u.last_name, u.avatar_url, st.title, st.bio, st.specialties, st.created_at
    ORDER BY st.created_at`;
  return NextResponse.json({ staff });
}
