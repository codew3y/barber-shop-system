import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@barberhouse/backend/lib/prisma';
import { generateTokens } from '@barberhouse/backend/lib/auth';
import { hashPassword } from '@barberhouse/backend/lib/password';
import { publicUser, jsonError, sessionResponse } from '@barberhouse/backend/lib/api';
import { cleanText } from '@barberhouse/backend/lib/sanitize';
import { rateLimit } from '@barberhouse/backend/lib/rate-limit';
import { registerSchema } from '@barberhouse/backend/schemas/auth';

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, 'auth-register', 5, 60_000);
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
    data: {
      email,
      passwordHash,
      firstName: cleanText(firstName, 100),
      lastName: cleanText(lastName, 100),
      phone,
      role: 'customer',
    },
  });
  const tokens = generateTokens(user);
  return sessionResponse(publicUser(user), tokens, 201);
}
