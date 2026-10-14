import { createHmac, timingSafeEqual } from 'node:crypto';

// PayMongo QR Ph (dynamic, per-transaction) — replaces Stripe.
// Flow per docs: create PaymentIntent with payment_method_allowed ["qrph"],
// create PaymentMethod type "qrph", attach with client_key →
// next_action.code.image_url (base64 QR, single-use, ~30min expiry).
// Webhooks: payment.paid / payment.failed / qrph.expired, verified via
// HMAC-SHA256(secret, rawPayload) vs the Paymongo-Signature header.
// Amounts in centavos, PHP only. QR Ph minimum is PHP 1.00.

const API = 'https://api.paymongo.com/v1';

function secretKey(): string {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error('PayMongo not configured');
  return key;
}

function basicAuth(key: string): string {
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

interface PmError {
  detail?: string;
}
interface PmEnvelope<T> {
  data?: T;
  errors?: PmError[];
}

async function pm<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: basicAuth(secretKey()),
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => null)) as PmEnvelope<T> | null;
  if (!res.ok) {
    const detail =
      json?.errors?.map((e) => e.detail).filter(Boolean).join('; ') ||
      `PayMongo ${path} failed (${res.status})`;
    throw new Error(detail);
  }
  if (!json?.data) throw new Error(`PayMongo ${path} returned no data`);
  return json.data;
}

export function paymongoConfigured(): boolean {
  return !!process.env.PAYMONGO_SECRET_KEY;
}

export function isPaymongoTestMode(): boolean {
  return (process.env.PAYMONGO_SECRET_KEY ?? '').startsWith('sk_test_');
}

interface PmIntent {
  id: string;
  attributes: {
    status: string;
    client_key: string;
    metadata?: Record<string, string>;
    payments?: { id: string }[];
    next_action?: { code?: { image_url?: string; test_url?: string } } | null;
  };
}

export async function createQrIntent(params: {
  amountPesos: number;
  description: string;
  metadata: Record<string, string>;
}): Promise<{ intentId: string; clientKey: string; qrImageUrl: string; testUrl: string | null }> {
  const centavos = Math.round(params.amountPesos * 100);
  if (centavos < 100) throw new Error('Minimum QR Ph payment is ₱1.00');

  const intent = await pm<PmIntent>('/payment_intents', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        attributes: {
          amount: centavos,
          currency: 'PHP',
          payment_method_allowed: ['qrph'],
          description: params.description,
          metadata: params.metadata,
        },
      },
    }),
  });

  const method = await pm<{ id: string }>('/payment_methods', {
    method: 'POST',
    body: JSON.stringify({ data: { attributes: { type: 'qrph' } } }),
  });

  const attached = await pm<PmIntent>(`/payment_intents/${intent.id}/attach`, {
    method: 'POST',
    body: JSON.stringify({
      data: {
        attributes: {
          payment_method: method.id,
          client_key: intent.attributes.client_key,
        },
      },
    }),
  });

  const qrImageUrl = attached.attributes.next_action?.code?.image_url;
  if (!qrImageUrl) throw new Error('QR code not returned by PayMongo');
  return {
    intentId: intent.id,
    clientKey: intent.attributes.client_key,
    qrImageUrl,
    testUrl: attached.attributes.next_action?.code?.test_url ?? null,
  };
}

export interface PmWebhookEvent {
  type: string;
  paymentId: string | null;
  intentId: string | null;
  bookingId: string | null;
}

interface PmEventEnvelope {
  data?: {
    attributes?: {
      type?: string;
      data?: {
        id?: string;
        attributes?: {
          payment_intent_id?: string;
          metadata?: Record<string, string>;
        };
      };
    };
  };
}

export function verifyWebhookSignature(
  rawPayload: string,
  signatureHeader: string
): PmWebhookEvent {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) throw new Error('PayMongo webhooks not configured');
  // Header format: "t=<timestamp>,te=<test-sig>,li=<live-sig>".
  // Signed content is "<timestamp>.<rawBody>"; test events use `te`,
  // live events use `li`. Older docs show a bare hex signature — accept
  // that too so single-secret setups keep working.
  const parts = Object.fromEntries(
    (signatureHeader || '').split(',').map((p) => {
      const idx = p.indexOf('=');
      return idx === -1 ? [p.trim(), ''] : [p.slice(0, idx).trim(), p.slice(idx + 1).trim()];
    })
  );
  const timestamp = parts.t ?? '';
  const candidates = [parts.te, parts.li, parts[''] ?? signatureHeader.trim()].filter(
    (s): s is string => !!s
  );
  const signedContents = timestamp ? [`${timestamp}.${rawPayload}`, rawPayload] : [rawPayload];
  const ok = signedContents.some((content) => {
    const expected = createHmac('sha256', secret).update(content, 'utf8').digest('hex');
    return candidates.some((sig) => {
      const a = Buffer.from(expected);
      const b = Buffer.from(sig);
      return a.length === b.length && timingSafeEqual(a, b);
    });
  });
  if (!ok) {
    throw new Error('Invalid webhook signature');
  }
  const envelope = JSON.parse(rawPayload) as PmEventEnvelope;
  const attrs = envelope.data?.attributes;
  const payment = attrs?.data;
  const paymentAttrs = payment?.attributes ?? {};
  return {
    type: attrs?.type ?? 'unknown',
    paymentId: payment?.id ?? null,
    intentId: paymentAttrs.payment_intent_id ?? null,
    bookingId: paymentAttrs.metadata?.bookingId ?? null,
  };
}

/** Resolve the PayMongo payment id (pay_*) for an intent — needed for refunds. */
export async function resolvePaymentId(intentId: string): Promise<string | null> {
  const intent = await pm<PmIntent>(`/payment_intents/${intentId}`, { method: 'GET' });
  const payments = intent.attributes.payments ?? [];
  return payments[0]?.id ?? null;
}

export async function createRefund(args: {
  paymentId: string;
  amountPesos?: number;
}): Promise<unknown> {
  return pm('/refunds', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        attributes: {
          payment_id: args.paymentId,
          ...(args.amountPesos ? { amount: Math.round(args.amountPesos * 100) } : {}),
          reason: 'requested_by_customer',
        },
      },
    }),
  });
}
