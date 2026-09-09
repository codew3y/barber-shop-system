import { prisma } from './prisma';

export interface ShopCardService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string;
  bufferMinutes: number;
  category: string | null;
  staff: { customPrice: string | null; staff: { id: string; user: { firstName: string; lastName: string } } }[];
}

export interface ShopCardStaff {
  id: string;
  title: string | null;
  bio: string | null;
  specialties: string[];
  user: { firstName: string; lastName: string };
}

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string;
  bufferMinutes: number;
  category: string | null;
  barbers: { id: string; firstName: string; lastName: string; customPrice: string | null }[] | null;
}

interface StaffRow {
  id: string;
  title: string | null;
  bio: string | null;
  specialties: string[];
  firstName: string;
  lastName: string;
}

interface ShopRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  timezone: string;
}

// Three parallel aggregate queries (one network wave) instead of Prisma's
// per-relation roundtrips — much faster against remote Postgres.
export async function getShopPageData(shopId?: string) {
  const [shopRows, serviceRows, staffRows] = await Promise.all([
    prisma.$queryRaw<ShopRow[]>`
      SELECT id::text AS id, name, slug, description, address_line1 AS "addressLine1",
        city, state, postal_code AS "postalCode", country, phone, timezone
      FROM shops
      WHERE (${shopId ?? null}::text IS NULL OR (id = ${shopId}::uuid AND is_active AND deleted_at IS NULL))
      ORDER BY created_at LIMIT 1`,
    prisma.$queryRaw<ServiceRow[]>`
      SELECT sv.id::text AS id, sv.name, sv.description,
        sv.duration_minutes AS "durationMinutes", sv.price::text AS price,
        sv.buffer_minutes AS "bufferMinutes", sv.category,
        COALESCE(json_agg(json_build_object(
          'id', st.id, 'firstName', u.first_name, 'lastName', u.last_name,
          'customPrice', ss.custom_price
        ) ORDER BY u.first_name) FILTER (WHERE st.id IS NOT NULL), '[]') AS barbers
      FROM services sv
      LEFT JOIN staff_services ss ON ss.service_id = sv.id
      LEFT JOIN staff st ON st.id = ss.staff_id
      LEFT JOIN users u ON u.id = st.user_id
      WHERE sv.shop_id = (
        SELECT id FROM shops WHERE (${shopId ?? null}::text IS NULL OR (id = ${shopId}::uuid AND is_active AND deleted_at IS NULL))
        ORDER BY created_at LIMIT 1
      )
        AND sv.is_active AND sv.deleted_at IS NULL
      GROUP BY sv.id ORDER BY sv.price`,
    prisma.$queryRaw<StaffRow[]>`
      SELECT st.id::text AS id, st.title, st.bio, st.specialties,
        u.first_name AS "firstName", u.last_name AS "lastName"
      FROM staff st JOIN users u ON u.id = st.user_id
      WHERE st.shop_id = (
        SELECT id FROM shops WHERE (${shopId ?? null}::text IS NULL OR (id = ${shopId}::uuid AND is_active AND deleted_at IS NULL))
        ORDER BY created_at LIMIT 1
      )
        AND st.is_active AND st.deleted_at IS NULL
      ORDER BY st.created_at`,
  ]);

  const shop = shopRows[0] ?? null;
  if (!shop) return null;

  const services: ShopCardService[] = serviceRows.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: Number(s.durationMinutes),
    price: s.price,
    bufferMinutes: Number(s.bufferMinutes),
    category: s.category,
    staff: (s.barbers ?? []).map((b) => ({
      customPrice: b.customPrice,
      staff: { id: b.id, user: { firstName: b.firstName, lastName: b.lastName } },
    })),
  }));

  const staff: ShopCardStaff[] = staffRows.map((s) => ({
    id: s.id,
    title: s.title,
    bio: s.bio,
    specialties: s.specialties ?? [],
    user: { firstName: s.firstName, lastName: s.lastName },
  }));

  return { shop, services, staff };
}
