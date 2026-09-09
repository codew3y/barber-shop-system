import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { generateTokens } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { publicUser, jsonError } from '@/lib/api';
import { cleanText } from '@/lib/sanitize';
import { rateLimit } from '@/lib/rate-limit';
import { guestSchema } from '@/schemas/auth';

// Phone-only guest checkout: creates a customer account with a random
// password (no login needed to book). The number identifies the guest;
// if it's already registered, they should log in instead.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'auth-guest', 5, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = guestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { firstName, lastName, phone, email: providedEmail } = parsed.data;

  const digits = phone.replace(/\D/g, '');
  const email = providedEmail ?? `guest.${digits}@barberhouse.local`;
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });
  if (existing) {
    return jsonError(
      providedEmail
        ? 'This email or number is already registered — please log in instead'
        : 'This number is already registered — please log in instead',
      409
    );
  }

  const passwordHash = await hashPassword(randomBytes(24).toString('hex'));
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
  const tokens = generateTokens(user.id);
  return NextResponse.json(
    { user: publicUser(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
    { status: 201 }
  );
}
