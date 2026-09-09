import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { generateTokens } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { publicUser, jsonError } from '@/lib/api';
import { cleanText } from '@/lib/sanitize';
import { rateLimit } from '@/lib/rate-limit';
import { guestSchema } from '@/schemas/auth';

// Guest checkout: creates a customer account with a random password
// (no login needed to book). Repeat guests reuse their details freely:
// an email/phone that belongs to a guest placeholder account resumes it,
// while a real registered email still asks them to log in instead.
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
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail && !byEmail.email.endsWith('@barberhouse.local')) {
    return jsonError('This email is already registered — please log in instead', 409);
  }
  const byPhone = await prisma.user.findUnique({ where: { phone } });
  if (byPhone && !byPhone.email.endsWith('@barberhouse.local') && byPhone.id !== byEmail?.id) {
    return jsonError('This number is already registered — please log in instead', 409);
  }
  const reusable = byEmail ?? byPhone;
  if (reusable) {
    const user = await prisma.user.update({
      where: { id: reusable.id },
      data: {
        firstName: cleanText(firstName, 100),
        lastName: cleanText(lastName, 100),
        phone,
        ...(providedEmail ? { email: providedEmail } : {}),
      },
    });
    const tokens = generateTokens(user.id);
    return NextResponse.json(
      { user: publicUser(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
      { status: 200 }
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
