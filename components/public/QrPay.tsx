'use client';

import QRCode from 'react-qr-code';
import { ArrowLeft, QrCode } from 'lucide-react';
import { peso } from '@/lib/format';

// QRPh scan-to-pay panel: the code carries the payment reference + exact
// amount. The customer pays in their e-wallet, taps "I've paid", and the
// shop confirms the pending payment on the staff dashboard.
export function QrPay({
  amount,
  reference,
  onPaid,
  onBack,
}: {
  amount: number;
  reference: string;
  onPaid: () => void;
  onBack: () => void;
}) {
  const payload = `BARBERHOUSE|${reference}|PHP ${amount.toFixed(2)}`;

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
        Scan with any e-wallet to pay the downpayment. Reference <span className="font-medium text-ivory">{reference}</span>.
      </p>
      <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-3" data-testid="qr-code">
        <QRCode value={payload} size={180} />
      </div>
      <p className="muted mt-3 text-xs">Downpayments are non-refundable.</p>
      <div className="mt-5 flex justify-center gap-3">
        <button onClick={onBack} className="btn-ghost">
          <ArrowLeft size={15} /> Back
        </button>
        <button onClick={onPaid} className="btn-primary">
          I&apos;ve paid — notify the shop
        </button>
      </div>
    </div>
  );
}
