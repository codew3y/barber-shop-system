'use client';

import { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, apiJson } from '@/lib/api-client';
import type { Booking } from '@/lib/types';
import { QrPay } from './QrPay';

type Pending = {
  amount: number;
  reference: string | null;
  qrImageUrl: string | null;
  testUrl?: string | null;
};

/**
 * Start (or resume) the downpayment for a booking and show the QRPh panel.
 *
 * Same two-mode contract as checkout: PayMongo dynamic QR when payments are
 * configured, manual reference QR when create-intent answers 503. The QR
 * route is idempotent — it returns the existing pending payment rather than
 * creating a second one — so this is safe to open, close and reopen.
 */
export function PayNow({
  bookingId,
  onConfirmed,
  className = '',
}: {
  bookingId: string;
  onConfirmed?: () => void;
  className?: string;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [loading, setLoading] = useState(false);

  // Poll for confirmation (PayMongo webhook, or the shop confirming manually).
  useEffect(() => {
    if (!pending) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      if (tries > 100) {
        clearInterval(timer);
        return;
      }
      try {
        const data = await apiJson<{ booking: Booking }>(`/api/v1/bookings/${bookingId}`);
        if (data.booking.status === 'confirmed') {
          clearInterval(timer);
          setPending(null);
          toast.success('Payment confirmed — see you soon.');
          onConfirmed?.();
        }
      } catch {
        // keep polling; confirmation may simply not have landed yet
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [pending, bookingId, onConfirmed]);

  async function start() {
    setLoading(true);
    try {
      const intentRes = await apiFetch('/api/v1/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({ bookingId, type: 'deposit' }),
      });
      if (intentRes.status === 503) {
        const qr = await apiJson<{ amount: string; reference: string }>('/api/v1/payments/qr', {
          method: 'POST',
          body: JSON.stringify({ bookingId, type: 'deposit' }),
        });
        setPending({ amount: Number(qr.amount), reference: qr.reference, qrImageUrl: null });
        return;
      }
      if (!intentRes.ok) {
        const body = (await intentRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Payment failed (${intentRes.status})`);
      }
      const intent = (await intentRes.json()) as { amount: string; qrImageUrl: string; testUrl?: string };
      setPending({ amount: Number(intent.amount), reference: null, qrImageUrl: intent.qrImageUrl, testUrl: intent.testUrl ?? null });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (pending) {
    return (
      <div className="inset mt-4 rounded-2xl px-4 py-6">
        <QrPay
          amount={pending.amount}
          reference={pending.reference}
          qrImageUrl={pending.qrImageUrl}
          testUrl={pending.testUrl}
          onBack={() => setPending(null)}
        />
      </div>
    );
  }

  return (
    <button onClick={start} disabled={loading} className={`btn-primary ${className}`}>
      {loading ? (
        'Opening…'
      ) : (
        <>
          <QrCode size={15} /> Pay downpayment
        </>
      )}
    </button>
  );
}
