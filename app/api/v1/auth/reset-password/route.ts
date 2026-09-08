import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPasswordResetToken } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { jsonError } from '@/lib/api';
import { resetPasswordSchema } from '@/schemas/auth';

export async function POST(req: NextRequest) {
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

  let userId: string;
  try {
    ({ userId } = verifyPasswordResetToken(parsed.data.token));
  } catch {
    return jsonError('Invalid or expired reset token', 400);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return NextResponse.json({ success: true });
}
