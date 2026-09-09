'use client';

import QRCode from 'react-qr-code';
import { ArrowLeft, QrCode } from 'lucide-react';
import { peso } from '@/lib/format';

// QRPh scan-to-pay panel. Two modes:
// - PayMongo dynamic QR (qrImageUrl set): real per-transaction code from
//   create-intent; the webhook auto-confirms and we poll the booking.
// - Manual reference fallback (qrImageUrl null): static code carrying the
//   payment reference; the customer pays in their e-wallet and taps
//   "I've paid", and the shop confirms on the staff dashboard.
export function QrPay({
  amount,
  reference,
  qrImageUrl,
  onPaid,
  onBack,
}: {
  amount: number;
  reference?: string | null;
  qrImageUrl?: string | null;
  onPaid: () => void;
  onBack: () => void;
}) {
  const payload = `BARBERHOUSE|${reference}|PHP ${amount.toFixed(2)}`;
  const paidLabel = qrImageUrl ? "I've scanned — continue" : "I've paid — notify the shop";

  return (
    <div className="text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-brass-300"
        style={{ background: 'rgb(196 160 72 / 0.12)', boxShadow: 'inset 0 0 0 1px rgb(196 160 72 / 0.25)' }}
      >
        <QrCode size={22} />
      </span>
      <p className="font-display text-2xl" data-numeric>
        {peso(amount)}
      </p>
      <p className="muted mt-1 text-sm">
        {qrImageUrl ? (
          <>Scan with GCash, Maya, or your bank app. Confirmation is automatic.</>
        ) : (
          <>Scan with any e-wallet to pay the downpayment. Reference <span className="font-medium text-ivory">{reference}</span>.</>
        )}
      </p>
      <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-3" data-testid="qr-code">
        {qrImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrImageUrl} alt="Scan to pay" width={180} height={180} />
        ) : (
          <QRCode value={payload} size={180} />
        )}
      </div>
      <p className="muted mt-3 text-xs">Downpayments are non-refundable.</p>
      <div className="mt-5 flex justify-center gap-3">
        <button onClick={onBack} className="btn-ghost">
          <ArrowLeft size={15} /> Back
        </button>
        <button onClick={onPaid} className="btn-primary">
          {paidLabel}
        </button>
      </div>
    </div>
  );
}
