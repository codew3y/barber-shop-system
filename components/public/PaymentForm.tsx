'use client';

import { useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { ArrowLeft } from 'lucide-react';
import { peso } from '@/lib/format';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const stripePromise: Promise<Stripe | null> | null = publishableKey
  ? loadStripe(publishableKey)
  : null;

export function stripeEnabled(): boolean {
  return stripePromise !== null;
}

function PayForm({
  amount,
  onPaid,
  onBack,
}: {
  amount: number;
  onPaid: () => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  async function pay() {
    if (!stripe || !elements) return;
    setError(null);
    setPaying(true);
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {},
      redirect: 'if_required',
    });
    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed — try another card.');
      setPaying(false);
      return;
    }
    if (paymentIntent?.status === 'succeeded') {
      onPaid();
    } else {
      setError(`Payment ${paymentIntent?.status ?? 'incomplete'} — check the confirmation page for status.`);
      setPaying(false);
    }
  }

  return (
    <div>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <p role="alert" className="mt-3 text-sm text-ember">
          {error}
        </p>
      )}
      <div className="mt-5 flex gap-3">
        <button onClick={onBack} disabled={paying} className="btn-ghost">
          <ArrowLeft size={15} /> Back
        </button>
        <button onClick={pay} disabled={paying || !stripe || !elements} className="btn-primary">
          {paying ? 'Paying…' : `Pay ${peso(amount)}`}
        </button>
      </div>
      <p className="muted mt-3 text-xs">Test mode: use card 4242 4242 4242 4242, any future expiry.</p>
    </div>
  );
}

export function StripePayment({
  clientSecret,
  amount,
  onPaid,
  onBack,
}: {
  clientSecret: string;
  amount: number;
  onPaid: () => void;
  onBack: () => void;
}) {
  if (!stripePromise) return null;
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'night',
          variables: { colorPrimary: '#c4a048', borderRadius: '12px' },
        },
      }}
    >
      <PayForm amount={amount} onPaid={onPaid} onBack={onBack} />
    </Elements>
  );
}
