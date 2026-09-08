'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBookingStore } from '@/stores/bookingStore';
import { useAuthStore } from '@/stores/authStore';
import { apiJson } from '@/lib/api-client';
import { peso } from '@/lib/format';
import type { Booking, StaffMember } from '@/lib/types';
import { ArrowRight, CalendarClock, ClipboardCheck, Scissors } from 'lucide-react';
import { ServiceSelector } from './ServiceSelector';
import { StaffPicker } from './StaffPicker';
import { SlotPicker } from './SlotPicker';
const steps = [
  { key: 'service', label: 'Barber & Service', Icon: Scissors },
  { key: 'slot', label: 'Time', Icon: CalendarClock },
  { key: 'checkout', label: 'Review', Icon: ClipboardCheck },
] as const;

const stepIndex = (s: string) => (s === 'service' ? 0 : s === 'slot' ? 1 : 2);

export function CheckoutFlow({ shopId, shopName, initialStaffId }: { shopId: string; shopName: string; initialStaffId?: string }) {
  const router = useRouter();
  const { service, staff, slot, step, start, setService, setStaff, clearStaff, setSlot, setStep, reset } =
    useBookingStore();
  const { user, setSession } = useAuthStore();
  const [notes, setNotes] = useState('');
  const [guest, setGuest] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (initialStaffId) {
        try {
          const data = await apiJson<{ staff: StaffMember[] }>(`/api/v1/shops/${shopId}/staff`);
          const match = data.staff.find((s) => s.id === initialStaffId) ?? null;
          if (!cancelled) start(shopId, match);
          return;
        } catch {
          // fall through to plain start
        }
      }
      if (!cancelled) start(shopId);
    }
    void init();
    return () => {
      cancelled = true;
      reset();
    };
  }, [shopId, initialStaffId, start, reset]);

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

  const go = (s: 'service' | 'slot' | 'checkout') => {
    setError(null);
    setStep(s);
  };

  const canContinueDetails = !!service && !!staff;
  const canContinueSlot = !!slot;

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest text-copper-200">BOOKING — {shopName.toUpperCase()}</p>
      <h1 className="font-display mb-5 text-3xl">Take a chair in three steps</h1>

      <ol className="mb-6 flex flex-wrap gap-2 text-sm">
        {steps.map(({ key, label, Icon }, i) => (
          <li
            key={key}
            className={`flex items-center gap-1.5 rounded px-3 py-1 ${
              stepIndex(step) === i
                ? 'bg-pine-900 font-medium text-cream'
                : stepIndex(step) > i
                  ? 'bg-copper-600/15 text-copper-200'
                  : 'bg-cream/5 text-cream/60'
            }`}
          >
            <Icon size={15} /> {label}
          </li>
        ))}
      </ol>

      {step === 'service' && (
        <div className="grid gap-6">
          <div>
            <h2 className="font-display mb-3 text-xl">1 · Pick a service</h2>
            <ServiceSelector
              shopId={shopId}
              selected={service}
              onSelect={(s) => {
                setService(s);
                if (staff && !(staff.services ?? []).some((x) => x.service.id === s.id)) {
                  clearStaff();
                }
              }}
            />
          </div>
          <div>
            <h2 className="font-display mb-3 text-xl">2 · Pick your barber</h2>
            {staff && (
              <p className="mb-2 text-sm text-cream/60">
                Barber: <span className="font-medium text-cream">{staff.user.firstName} {staff.user.lastName}</span> — tap another card to change.
              </p>
            )}
            <StaffPicker shopId={shopId} serviceId={service?.id} selected={staff} onSelect={setStaff} />
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div>
            <button
              onClick={() => {
                if (!canContinueDetails) {
                  setError('Pick a service and a barber to continue.');
                  return;
                }
                go('slot');
              }}
              className="btn-primary flex items-center gap-1.5"
            >
              Continue <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}
      {step === 'slot' && service && staff && (
        <>
          <SlotPicker
            shopId={shopId}
            staffId={staff.id}
            serviceId={service.id}
            barberName={staff.user.firstName}
            selected={slot}
            onSelect={setSlot}
          />
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={() => go('service')} className="btn-ghost">
              ← Back
            </button>
            <button
              onClick={() => {
                if (!canContinueSlot) {
                  setError('Pick a time to continue.');
                  return;
                }
                go('checkout');
              }}
              className="btn-primary flex items-center gap-1.5"
            >
              Continue <ArrowRight size={15} />
            </button>
          </div>
        </>
      )}
      {step === 'checkout' && service && staff && slot && (
        <div className="card">
          <h2 className="font-display mb-2 text-xl">The ticket</h2>
          <dl className="mb-4 grid gap-1 text-sm">
            <div className="flex justify-between"><dt className="text-cream/60">Cut</dt><dd className="font-medium">{service.name} — {peso(staff.services?.find((x) => x.service.id === service.id)?.customPrice ?? service.price)}</dd></div>
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
