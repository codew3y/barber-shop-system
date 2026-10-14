export type Role = 'customer' | 'staff' | 'admin' | 'super_admin';

const permissions: Record<Role, string[]> = {
  customer: [
    'bookings:create',
    'bookings:read:own',
    'bookings:cancel:own',
    'payments:create',
    'profile:read:own',
    'profile:update:own',
  ],
  staff: [
    'bookings:read:assigned',
    'bookings:update:assigned',
    'schedule:read:own',
    'time-off:create:own',
    'time-off:read:own',
    'earnings:read:own',
  ],
  admin: [
    'staff:create',
    'staff:read:shop',
    'staff:update:shop',
    'staff:delete:shop',
    'services:create:shop',
    'services:read:shop',
    'services:update:shop',
    'services:delete:shop',
    'bookings:read:shop',
    'analytics:read:shop',
    'settings:update:shop',
  ],
  super_admin: ['*'],
};

export function hasPermission(role: Role, permission: string): boolean {
  const perms = permissions[role];
  if (!perms) return false;
  return perms.includes('*') || perms.includes(permission);
}
