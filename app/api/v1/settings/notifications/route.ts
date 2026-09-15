import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, jsonError } from '@/lib/api';
import { DEFAULT_PREFS } from '@/lib/preferences';
import { updateNotificationPrefsSchema } from '@/schemas/notifications';

// Per-user notification channel preferences (Phase 5.2). Missing row =
// everything on (backwards compatible with pre-prefs behavior).
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  const row = await prisma.notificationPreference.findUnique({
    where: { userId: auth.user.id },
  });
  return NextResponse.json({
    preferences: {
      emailConfirmations: row?.emailConfirmations ?? DEFAULT_PREFS.emailConfirmations,
      emailReminders: row?.emailReminders ?? DEFAULT_PREFS.emailReminders,
      pushConfirmations: row?.pushConfirmations ?? DEFAULT_PREFS.pushConfirmations,
      pushReminders: row?.pushReminders ?? DEFAULT_PREFS.pushReminders,
    },
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = updateNotificationPrefsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json({
    preferences: {
      emailConfirmations: preferences.emailConfirmations,
      emailReminders: preferences.emailReminders,
      pushConfirmations: preferences.pushConfirmations,
      pushReminders: preferences.pushReminders,
    },
  });
}
