import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from './auth';
import { prisma } from './prisma';
import { hasPermission, type Role } from './rbac';

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Serialize a user row without sensitive fields.
export function publicUser(user: {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  passwordHash?: string;
}) {
  const { passwordHash: _omit, ...safe } = user;
  return safe;
}

export function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

export async function requireAuth(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return { error: jsonError('No token provided', 401) as NextResponse };
  try {
    const decoded = verifyAccessToken(token);
    if (decoded.type !== 'access') return { error: jsonError('Invalid token', 401) as NextResponse };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.deletedAt) return { error: jsonError('User not found', 401) as NextResponse };
    return { user };
  } catch {
    return { error: jsonError('Invalid token', 401) as NextResponse };
  }
}

export async function requireRole(req: NextRequest, ...roles: Role[]) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth;
  if (!roles.includes(auth.user.role as Role)) {
    return { error: jsonError('Insufficient permissions', 403) as NextResponse };
  }
  return auth;
}

export function requirePermission(role: Role, permission: string): boolean {
  return hasPermission(role, permission);
}
