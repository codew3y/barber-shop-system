import { prisma } from './prisma';
import type { Staff } from '@prisma/client';

// Resolve the staff profile in scope: staff users get their own profile,
// admins may target any staff profile in their shop via explicit staffId.
export async function resolveStaffProfile(
  userId: string,
  userRole: string,
  opts: { shopId?: string; staffId?: string }
): Promise<{ profile: (Staff & { shopId: string }) | null; error?: string }> {
  if (opts.staffId) {
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return { profile: null, error: 'Only admins can view other staff' };
    }
    const target = await prisma.staff.findFirst({
      where: { id: opts.staffId, deletedAt: null },
    });
    if (!target) return { profile: null, error: 'Staff not found' };
    if (opts.shopId && target.shopId !== opts.shopId) {
      return { profile: null, error: 'Staff not in this shop' };
    }
    return { profile: target };
  }

  const where: { userId: string; deletedAt: null; shopId?: string } = {
    userId,
    deletedAt: null,
  };
  if (opts.shopId) where.shopId = opts.shopId;
  const profile = await prisma.staff.findFirst({ where, orderBy: { createdAt: 'asc' } });
  if (!profile) return { profile: null, error: 'No staff profile found' };
  return { profile };
}

export async function isShopAdmin(userId: string, userRole: string, shopId: string): Promise<boolean> {
  if (userRole === 'super_admin') return true;
  if (userRole !== 'admin') return false;
  const shop = await prisma.shop.findFirst({ where: { id: shopId, deletedAt: null } });
  if (!shop) return false;
  if (shop.ownerId === userId) return true;
  const profile = await prisma.staff.findFirst({ where: { userId, shopId, deletedAt: null } });
  return profile !== null;
}
