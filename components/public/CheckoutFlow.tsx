'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBookingStore } from '@/stores/bookingStore';
import { useAuthStore } from '@/stores/authStore';
import { apiJson } from '@/lib/api-client';
import { depositFor, peso } from '@/lib/format';
import { toast } from 'sonner';
import type { Booking, StaffMember } from '@/lib/types';
import { ArrowLeft, ArrowRight, CalendarClock, Check, ClipboardCheck, Scissors } from 'lucide-react';
import { BarberServicePicker } from './BarberServicePicker';
import { SlotPicker } from './SlotPicker';

const steps = [
  { key: 'service', label: 'Barber & Service', Icon: Scissors },
  { key: 'slot', label: 'Time', Icon: CalendarClock },
  { key: 'checkout', label: 'Review', Icon: ClipboardCheck },
] as const;

const stepIndex = (s: string) => (s === 'service' ? 0 : s === 'slot' ? 1 : 2);

function StepRail({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex items-center gap-2 sm:gap-4">
      {steps.map(({ key, label, Icon }, i) => {
        const state = i === current ? 'current' : i < current ? 'done' : 'todo';
        return (
          <li key={key} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow,color] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                  state === 'current'
                    ? 'text-ink-950'
                    : state === 'done'
                      ? 'text-brass-300'
                      : 'text-ivory-dim/55'
                }`}
                style={
                  state === 'current'
                    ? {
                        background:
                          'linear-gradient(180deg, var(--color-brass-400), var(--color-brass-500))',
                        boxShadow: 'var(--glow-brass)',
                      }
                    : {
                        background: state === 'done' ? 'rgb(196 160 72 / 0.14)' : 'transparent',
                        boxShadow: `inset 0 0 0 1px ${
                          state === 'done' ? 'rgb(196 160 72 / 0.3)' : 'var(--line)'
                        }`,
                      }
                }
              >
                {state === 'done' ? <Check size={16} /> : <Icon size={16} />}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.625rem] uppercase tracking-[0.16em] text-ivory-dim/60">
                  Step {i + 1}
                </span>
                <span
                  className={`hidden truncate text-sm font-medium sm:block ${
                    state === 'todo' ? 'text-ivory-dim/70' : 'text-ivory'
                  }`}
                >
                  {label}
                </span>
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className="h-px min-w-4 flex-1 origin-left transition-colors duration-250"
                style={{
                  background: i < current ? 'var(--color-brass-500)' : 'var(--line-strong)',
                }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function TicketRow({
  label,
  value,
  accent = false,
  total = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  total?: boolean;
}) {
  return (
    <div className={`flex items-baseline gap-3 ${total ? 'pt-3' : ''}`} style={total ? { borderTop: '1px solid var(--line)' } : undefined}>
      <dt className="text-sm text-ivory-dim">{label}</dt>
      <span className="mb-1 h-px flex-1 border-b border-dotted border-ivory/15" />
      <dd
        className={`shrink-0 text-sm font-medium ${accent ? 'text-brass-300' : 'text-ivory'}`}
        data-numeric
      >
        {value}
      </dd>
    </div>
  );
}

export function CheckoutFlow({ shopId, shopName, initialStaffId }: { shopId: string; shopName: string; initialStaffId?: string }) {
  const router = useRouter();
  const { service, staff, slot, step, start, setService, setStaff, clearStaff, setSlot, setStep, reset } =
    useBookingStore();
  const { user, setSession } = useAuthStore();
  const [notes, setNotes] = useState('');
  const [guest, setGuest] = useState({ firstName: '', lastName: '', phone: '' });
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
    if (!guest.firstName || !guest.lastName || guest.phone.replace(/\D/g, '').length < 7) {
      setError('Add your name and phone number — no password needed, we keep the booking under your number.');
      return false;
    }
    try {
      const data = await apiJson<{ user: never; accessToken: string; refreshToken: string }>(
        '/api/v1/auth/guest',
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
      toast.success('Chair reserved — see you soon.');
      router.push(`/bookings/${data.booking.id}`);
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      toast.error(message);
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

  const price = staff?.services?.find((x) => x.service.id === service?.id)?.customPrice ?? service?.price;

  const errorNote = error && (
    <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-ember">
      <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
      {error}
    </p>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <p className="eyebrow">Booking · {shopName}</p>
      <h1 className="font-display mt-3 mb-8 text-4xl sm:text-5xl">Take a chair in three steps</h1>

      <StepRail current={stepIndex(step)} />

      {step === 'service' && (
        <div key="service" className="step-enter">
          <BarberServicePicker
            shopId={shopId}
            service={service}
            staff={staff}
            onSelectService={(s) => {
              setService(s);
              if (staff && !(staff.services ?? []).some((x) => x.service.id === s.id)) {
                clearStaff();
              }
            }}
            onSelectStaff={setStaff}
          />
          {errorNote}
          <div className="mt-6">
            <button
              onClick={() => {
                if (!canContinueDetails) {
                  setError('Pick a barber and a service to continue.');
                  return;
                }
                go('slot');
              }}
              className="btn-primary"
            >
              Continue <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {step === 'slot' && service && staff && (
        <div key="slot" className="step-enter">
          <SlotPicker
            shopId={shopId}
            staffId={staff.id}
            serviceId={service.id}
            barberName={staff.user.firstName}
            selected={slot}
            onSelect={setSlot}
          />
          {errorNote}
          <div className="mt-6 flex gap-3">
            <button onClick={() => go('service')} className="btn-ghost">
              <ArrowLeft size={15} /> Back
            </button>
            <button
              onClick={() => {
                if (!canContinueSlot) {
                  setError('Pick a time to continue.');
                  return;
                }
                go('checkout');
              }}
              className="btn-primary"
            >
              Continue <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {step === 'checkout' && service && staff && slot && (
        <div className="step-enter grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* Guest details + notes */}
          <div className="card order-2 lg:order-1">
            <h2 className="font-display text-xl">Your details</h2>
            {!user ? (
              <>
                <p className="muted mt-1.5 text-sm">
                  Checking out as a guest — just your name and number, no password.
                </p>
                <div className="mt-5 grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      placeholder="First name"
                      value={guest.firstName}
                      onChange={(e) => setGuest({ ...guest, firstName: e.target.value })}
                      className="field"
                    />
                    <input
                      placeholder="Last name"
                      value={guest.lastName}
                      onChange={(e) => setGuest({ ...guest, lastName: e.target.value })}
                      className="field"
                    />
                  </div>
                  <input
                    placeholder="Phone number"
                    type="tel"
                    value={guest.phone}
                    onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                    className="field"
                  />
                </div>
              </>
            ) : (
              <p className="muted mt-1.5 text-sm">
                Booking as {user.firstName} {user.lastName}.
              </p>
            )}

            <label className="mt-5 block">
              <span className="text-sm text-ivory-dim">Notes for the barber (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="field mt-2 block"
              />
            </label>

            {errorNote}

            <div className="mt-6 flex gap-3">
              <button onClick={() => go('slot')} className="btn-ghost">
                <ArrowLeft size={15} /> Back
              </button>
              <button onClick={confirmBooking} disabled={submitting} className="btn-primary">
                {submitting ? 'Reserving…' : 'Reserve my chair'}
              </button>
            </div>
          </div>

          {/* The ticket */}
          <aside className="card order-1 h-fit lg:order-2 lg:sticky lg:top-24">
            <p className="eyebrow">The ticket</p>
            <h2 className="font-display mt-2.5 text-2xl">{service.name}</h2>
            <p className="muted mt-1 text-sm">
              with {staff.user.firstName} {staff.user.lastName}
            </p>

            <dl className="mt-5 grid gap-2.5">
              <TicketRow
                label="Chair time"
                value={new Date(slot.startTime).toLocaleString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              />
              <TicketRow label="Duration" value={`${service.durationMinutes} min`} />
              <TicketRow label="Total" value={peso(price!)} total />
              <TicketRow label="Downpayment due" value={peso(depositFor(Number(price)))} accent />
            </dl>

            <p className="muted mt-5 text-xs leading-relaxed">
              The balance is settled at the chair. Reschedule or release the chair any time from
              your dashboard.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
