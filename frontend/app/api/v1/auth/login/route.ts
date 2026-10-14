import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@barberhouse/backend/lib/prisma';
import { generateTokens } from '@barberhouse/backend/lib/auth';
import { verifyPassword } from '@barberhouse/backend/lib/password';
import { publicUser, jsonError } from '@barberhouse/backend/lib/api';
import { rateLimit } from '@barberhouse/backend/lib/rate-limit';
import { loginSchema } from '@barberhouse/backend/schemas/auth';

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, 'auth-login', 10, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.deletedAt) return jsonError('Invalid credentials', 401);
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return jsonError('Invalid credentials', 401);

  const tokens = generateTokens(user.id);
  return NextResponse.json({
    user: publicUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
}
