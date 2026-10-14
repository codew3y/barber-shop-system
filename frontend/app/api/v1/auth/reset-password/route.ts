import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@barberhouse/backend/lib/prisma';
import { passwordVersion, verifyPasswordResetToken } from '@barberhouse/backend/lib/auth';
import { hashPassword } from '@barberhouse/backend/lib/password';
import { jsonError } from '@barberhouse/backend/lib/api';
import { rateLimit } from '@barberhouse/backend/lib/rate-limit';
import { resetPasswordSchema } from '@barberhouse/backend/schemas/auth';

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, 'auth-reset', 5, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  let token: { userId: string; pv: string };
  try {
    token = verifyPasswordResetToken(parsed.data.token);
  } catch {
    return jsonError('Invalid or expired reset token', 400);
  }
  // The token is bound to the password it was issued against, so it works
  // once: after this update the version changes and the link is dead. The
  // same change ends every session issued before the reset.
  const user = await prisma.user.findUnique({ where: { id: token.userId } });
  if (!user || user.deletedAt || passwordVersion(user.passwordHash) !== token.pv) {
    return jsonError('Invalid or expired reset token', 400);
  }
  const userId = user.id;

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return NextResponse.json({ success: true });
}
