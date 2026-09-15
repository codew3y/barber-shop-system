import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

// Web Push delivery (Phase 4.3). VAPID keys come from env; without them
// sending is a silent no-op so keyless local dev and CI stay green.
// Push must never break the booking flow — all failures are caught.

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:hello@barberhouse.example',
      publicKey,
      privateKey
    );
    configured = true;
    return true;
  } catch (err) {
    console.error('[push] invalid VAPID keys', err);
    return false;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  if (!ensureConfigured()) return result;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ url: '/dashboard', ...payload })
      );
      result.sent += 1;
    } catch (err) {
      result.failed += 1;
      // 404/410 = subscription expired or revoked — prune it.
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error('[push] send failed', err);
      }
    }
  }
  return result;
}
