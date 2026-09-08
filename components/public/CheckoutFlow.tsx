'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBookingStore } from '@/stores/bookingStore';
import { useAuthStore } from '@/stores/authStore';
import { apiJson } from '@/lib/api-client';
import type { Booking } from '@/lib/types';
import { ServiceSelector } from './ServiceSelector';
import { StaffPicker } from './StaffPicker';
import { SlotPicker } from './SlotPicker';

const steps = ['service', 'barber', 'time', 'review'] as const;
const stepFor = (s: string) =>
  s === 'service' ? 0 : s === 'staff' ? 1 : s === 'slot' ? 2 : 3;

export function CheckoutFlow({ shopId, shopName }: { shopId: string; shopName: string }) {
  const router = useRouter();
  const { service, staff, slot, step, start, setService, setStaff, setSlot, setStep, reset } =
    useBookingStore();
  const { user, setSession } = useAuthStore();
  const [notes, setNotes] = useState('');
  const [guest, setGuest] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    start(shopId);
    return () => reset();
  }, [shopId, start, reset]);

  async function ensureAccount(): Promise<boolean> {
    if (user) return true;
    if (!guest.firstName || !guest.lastName || !guest.email || guest.password.length < 8) {
      setError('Add your name, email, and a password (8+ chars) — we open your account on the spot.');
      return false;
    }
    try {
      const data = await apiJson<{ user: never; accessToken: string; refreshToken: string }>(
        '/api/v1/auth/register',
        { method: 'POST', body: JSON.stringify(guest) }
      );
      setSession(data.user, data.accessToken, data.refreshToken);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }

  async function confirmBooking() {
    if (!service || !staff || !slot) return;
    setError(null);
    setSubmitting(true);
    try {
      if (!(await ensureAccount())) return;
      const data = await apiJson<{ booking: Booking }>(
        '/api/v1/bookings',
        {
          method: 'POST',
          headers: { 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({
            shopId,
            staffId: staff.id,
            serviceId: service.id,
            startTime: slot.startTime,
            notes: notes || undefined,
          }),
        }
      );
      reset();
      router.push(`/bookings/${data.booking.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const go = (s: 'service' | 'staff' | 'slot' | 'checkout') => setStep(s);

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest text-copper-200">BOOKING — {shopName.toUpperCase()}</p>
      <h1 className="font-display mb-5 text-3xl">Take a chair in four steps</h1>

      <ol className="mb-6 flex flex-wrap gap-2 text-sm">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`rounded px-3 py-1 ${
              stepFor(step) === i
                ? 'bg-pine-900 font-medium text-cream'
                : stepFor(step) > i
                  ? 'bg-copper-600/15 text-copper-200'
                  : 'bg-cream/5 text-cream/60'
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 'service' && (
        <ServiceSelector shopId={shopId} selected={service} onSelect={setService} />
      )}
      {step === 'staff' && service && (
        <>
          <button onClick={() => go('service')} className="mb-3 text-sm text-copper-200 underline">
            ← Swap service ({service.name})
          </button>
          <StaffPicker shopId={shopId} selected={staff} onSelect={setStaff} />
        </>
      )}
      {step === 'slot' && service && staff && (
        <>
          <button onClick={() => go('staff')} className="mb-3 text-sm text-copper-200 underline">
            ← Swap barber ({staff.user.firstName})
          </button>
          <SlotPicker
            shopId={shopId}
            staffId={staff.id}
            serviceId={service.id}
            selected={slot}
            onSelect={setSlot}
          />
        </>
      )}
      {step === 'checkout' && service && staff && slot && (
        <div className="card">
          <h2 className="font-display mb-2 text-xl">The ticket</h2>
          <dl className="mb-4 grid gap-1 text-sm">
            <div className="flex justify-between"><dt className="text-cream/60">Cut</dt><dd className="font-medium">{service.name} — ${Number(service.price).toFixed(2)}</dd></div>
            <div className="flex justify-between"><dt className="text-cream/60">Barber</dt><dd className="font-medium">{staff.user.firstName} {staff.user.lastName}</dd></div>
            <div className="flex justify-between"><dt className="text-cream/60">Chair time</dt><dd className="font-medium">{new Date(slot.startTime).toLocaleString()}</dd></div>
          </dl>
          {!user && (
            <div className="mb-4 grid gap-2">
              <p className="text-sm text-cream/60">Checking out as a guest — we&apos;ll open your account:</p>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="First name" value={guest.firstName} onChange={(e) => setGuest({ ...guest, firstName: e.target.value })} className="field" />
                <input placeholder="Last name" value={guest.lastName} onChange={(e) => setGuest({ ...guest, lastName: e.target.value })} className="field" />
              </div>
              <input placeholder="Email" type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} className="field" />
              <input placeholder="Password (8+ chars)" type="password" value={guest.password} onChange={(e) => setGuest({ ...guest, password: e.target.value })} className="field" />
            </div>
          )}
          <label className="mb-4 block text-sm">
            <span className="text-cream/60">Notes for the barber (optional)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="field mt-1 block w-full" />
          </label>
          {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => go('slot')} className="btn-ghost">
              ← Back
            </button>
            <button onClick={confirmBooking} disabled={submitting} className="btn-primary">
              {submitting ? 'Reserving…' : 'Reserve my chair'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
