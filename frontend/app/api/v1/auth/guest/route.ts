import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@barberhouse/backend/lib/prisma';
import { generateTokens } from '@barberhouse/backend/lib/auth';
import { hashPassword } from '@barberhouse/backend/lib/password';
import { publicUser, jsonError, scopedGuestUser, sessionResponse } from '@barberhouse/backend/lib/api';
import { cleanText } from '@barberhouse/backend/lib/sanitize';
import { rateLimit } from '@barberhouse/backend/lib/rate-limit';
import { guestSchema } from '@barberhouse/backend/schemas/auth';

// Guest checkout: creates a customer account with a random password
// (no login needed to book), flagged `isGuest`. Every guest gets their own
// row keyed by email/phone — two walk-ins are never merged into one shared
// account. A repeat guest books under their existing row with a session
// scoped to new bookings (see below); an email or phone that belongs to a
// *registered* user is asked to log in instead.
// A unique-index clash on email/phone is a user-facing conflict, not a crash.
// Two guests can race for the same number; answer with something actionable.
function conflictResponse(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    const target = (e.meta?.target as string[] | undefined)?.join(', ') ?? 'details';
    return jsonError(
      `That ${target.includes('phone') ? 'phone number' : 'email'} is already attached to another booking — try a different one.`,
      409
    );
  }
  return null;
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, 'auth-guest', 5, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = guestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { firstName, lastName, phone, email: providedEmail } = parsed.data;

  const digits = phone.replace(/\D/g, '');
  const email = providedEmail ?? `guest.${digits}@barberhouse.local`;
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail && !byEmail.isGuest) {
    return jsonError('This email is already registered — please log in instead', 409);
  }
  const byPhone = await prisma.user.findUnique({ where: { phone } });
  if (byPhone && !byPhone.isGuest && byPhone.id !== byEmail?.id) {
    return jsonError('This number is already registered — please log in instead', 409);
  }
  // Email is the identity anchor; fall back to phone when the email is new.
  const reusable = byEmail ?? byPhone;
  if (reusable) {
    // The caller has only shown that they know this email or phone, not that
    // they own the account. So the stored profile is left untouched (writing
    // their contact details onto it would redirect the account's reminders),
    // and the session they get reaches only bookings they make from now on.
    const tokens = generateTokens(reusable, { guestSince: new Date() });
    return sessionResponse(
      scopedGuestUser(reusable, {
        firstName: cleanText(firstName, 100),
        lastName: lastName ? cleanText(lastName, 100) : '',
        email: providedEmail ?? null,
        phone,
      }),
      tokens
    );
  }

  const passwordHash = await hashPassword(randomBytes(24).toString('hex'));
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: cleanText(firstName, 100),
        lastName: lastName ? cleanText(lastName, 100) : '',
        phone,
        role: 'customer',
        isGuest: true,
      },
    });
  } catch (e) {
    const conflict = conflictResponse(e);
    if (conflict) return conflict;
    throw e;
  }
  const tokens = generateTokens(user);
  return sessionResponse(publicUser(user), tokens, 201);
}
