import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generatePasswordResetToken } from '@/lib/auth';
import { jsonError } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { forgotPasswordSchema } from '@/schemas/auth';

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'auth-forgot', 3, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Always return success to avoid email enumeration.
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.deletedAt) return NextResponse.json({ success: true });

  const resetToken = generatePasswordResetToken(user.id);
  // Phase 5 will email this token. In dev we return it so the flow is testable.
  if (process.env.NODE_ENV === 'production') {
    // TODO: send via email provider
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: true, resetToken });
}
