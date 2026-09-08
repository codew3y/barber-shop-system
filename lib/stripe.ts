import Stripe from 'stripe';

let client: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    client = null;
    return null;
  }
  client = new Stripe(key);
  return client;
}

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export async function createIntent(params: {
  amountPesos: number;
  currency?: string;
  metadata: Record<string, string>;
}): Promise<{ clientSecret: string; intentId: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(params.amountPesos * 100), // centavos
    currency: (params.currency ?? 'php').toLowerCase(),
    metadata: params.metadata,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  });
  return { clientSecret: intent.client_secret ?? '', intentId: intent.id };
}

export function verifyWebhookSignature(payload: string, signature: string): Stripe.Event {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) throw new Error('Stripe webhooks not configured');
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

export async function createRefund(paymentIntentId: string, amountPesos?: number) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amountPesos ? { amount: Math.round(amountPesos * 100) } : {}),
  });
}
