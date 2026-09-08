import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateTokens } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { publicUser, jsonError } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { registerSchema } from '@/schemas/auth';

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'auth-register', 5, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password, firstName, lastName, phone } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] },
  });
  if (existing) return jsonError('Email or phone already in use', 409);

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName, phone, role: 'customer' },
  });
  const tokens = generateTokens(user.id);
  return NextResponse.json(
    { user: publicUser(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
    { status: 201 }
  );
}
