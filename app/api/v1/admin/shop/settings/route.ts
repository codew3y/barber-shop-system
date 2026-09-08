import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole, jsonError } from '@/lib/api';
import { isShopAdmin } from '@/lib/staff-scope';

const settingsSchema = z.object({
  shopId: z.string().uuid(),
  settings: z.record(z.string(), z.unknown()),
  name: z.string().min(1).max(255).optional(),
  phone: z.string().min(7).max(20).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, 'admin', 'super_admin');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  if (!(await isShopAdmin(auth.user.id, auth.user.role, parsed.data.shopId))) {
    return jsonError('Insufficient permissions', 403);
  }

  const shop = await prisma.shop.findUnique({ where: { id: parsed.data.shopId } });
  if (!shop) return jsonError('Shop not found', 404);

  const merged = { ...((shop.settingsJson as Record<string, unknown>) ?? {}), ...parsed.data.settings } as Prisma.InputJsonValue;
  const updated = await prisma.shop.update({
    where: { id: parsed.data.shopId },
    data: {
      settingsJson: merged,
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
    },
  });
  return NextResponse.json({ shop: updated });
}
