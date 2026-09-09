'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone, Plus } from 'lucide-react';
import { apiFetch, apiJson } from '@/lib/api-client';
import { useAuthStore } from '@/stores/authStore';
import { peso } from '@/lib/format';

interface ScheduleBooking {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  notes: string | null;
  service: { name: string };
  customer: { firstName: string; lastName: string; phone: string | null };
}

const NEXT_STATUS: Record<string, { value: string; label: string }[]> = {
  pending: [
    { value: 'confirmed', label: 'Confirm' },
    { value: 'no_show', label: 'No-show' },
    { value: 'cancelled', label: 'Cancel' },
  ],
  confirmed: [
    { value: 'completed', label: 'Complete' },
    { value: 'no_show', label: 'No-show' },
    { value: 'cancelled', label: 'Cancel' },
  ],
};

const LIVE_STATUSES = new Set(['pending', 'confirmed']);

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const fieldLabel = 'mb-2 block text-[0.6875rem] uppercase tracking-[0.14em] text-ivory-dim/70';

export default function StaffPage() {
  const { user, ready } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [offForm, setOffForm] = useState({ start: '', end: '', reason: '' });

  const schedule = useQuery({
    queryKey: ['staff-schedule', date],
    queryFn: () => apiJson<{ schedule: ScheduleBooking[] }>(`/api/v1/staff/schedule?date=${date}`),
    enabled: ready && !!user,
    refetchInterval: 15_000, // live-ish schedule without WebSocket (Phase 4.3)
  });

  const timeOff = useQuery({
    queryKey: ['staff-timeoff'],
    queryFn: () => apiJson<{ timeOff: { id: string; startAt: string; endAt: string; status: string; reason: string | null }[] }>('/api/v1/staff/time-off'),
    enabled: ready && !!user,
  });

  const monthStart = todayISO().slice(0, 8) + '01';
  const earnings = useQuery({
    queryKey: ['staff-earnings'],
    queryFn: () =>
      apiJson<{ bookings: number; revenue: string; earnings: string; commissionRate: string }>(
        `/api/v1/staff/earnings?startDate=${monthStart}&endDate=${todayISO()}`
      ),
    enabled: ready && !!user,
  });

  if (!ready) return <div className="skeleton h-64 rounded-2xl" />;
  if (!user) {
    router.push('/login');
    return <div className="skeleton h-64 rounded-2xl" />;
  }
  if (user.role !== 'staff' && user.role !== 'admin' && user.role !== 'super_admin') {
    return (
      <div className="card mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl">Staff only</h1>
        <p className="muted mt-2 text-sm">This chair view is restricted to shop staff.</p>
      </div>
    );
  }

  async function setStatus(id: string, status: string) {
    setError(null);
    const res = await apiFetch(`/api/v1/staff/schedule/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? 'Update failed');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['staff-schedule'] });
  }

  async function requestTimeOff(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await apiFetch('/api/v1/staff/time-off', {
      method: 'POST',
      body: JSON.stringify({
        startAt: new Date(offForm.start).toISOString(),
        endAt: new Date(offForm.end).toISOString(),
        reason: offForm.reason || undefined,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? 'Request failed');
      return;
    }
    setOffForm({ start: '', end: '', reason: '' });
    queryClient.invalidateQueries({ queryKey: ['staff-timeoff'] });
  }

  return (
    <div>
      <p className="eyebrow">The chair</p>
      <h1 className="font-display mt-3 text-4xl sm:text-5xl">Staff dashboard</h1>
      {error && (
        <p role="alert" className="mt-4 text-sm text-ember">
          {error}
        </p>
      )}

      <section className="card mt-10 p-6 sm:p-7">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl">Day schedule</h2>
            <p className="muted mt-1 text-sm">Refreshes on its own every 15 seconds.</p>
          </div>
          <label className="block">
            <span className={fieldLabel}>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field w-auto"
            />
          </label>
        </div>

        {schedule.isLoading ? (
          <div className="grid gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
            <span className="sr-only">Loading chairs…</span>
          </div>
        ) : !schedule.data?.schedule.length ? (
          <div className="inset rounded-xl px-4 py-12 text-center">
            <p className="font-display text-lg">Clear day</p>
            <p className="muted mt-1.5 text-sm">No bookings on the sheet.</p>
          </div>
        ) : (
          <ul className="grid gap-2.5">
            {schedule.data.schedule.map((b) => (
              <li key={b.id} className="inset rounded-xl px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span className="flex min-w-0 items-baseline gap-3">
                    <span className="font-display shrink-0 text-lg text-brass-200" data-numeric>
                      {new Date(b.startAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{b.service.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-xs text-ivory-dim/75">
                        <span>
                          {b.customer.firstName} {b.customer.lastName}
                        </span>
                        {b.customer.phone && (
                          <span className="flex items-center gap-1" data-numeric>
                            <Phone size={11} className="text-brass-400" />
                            {b.customer.phone}
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                  <span className={LIVE_STATUSES.has(b.status) ? 'badge-live' : 'badge-quiet'}>
                    {b.status}
                  </span>
                </div>

                {b.notes && (
                  <p className="muted mt-2.5 text-sm italic">&ldquo;{b.notes}&rdquo;</p>
                )}

                {(NEXT_STATUS[b.status] ?? []).length > 0 && (
                  <div className="mt-3.5 flex flex-wrap gap-2">
                    {NEXT_STATUS[b.status].map((a) => (
                      <button
                        key={a.value}
                        onClick={() => setStatus(b.id, a.value)}
                        className="btn-quiet"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-6 sm:p-7">
          <h2 className="font-display text-2xl">Time off</h2>
          <form onSubmit={requestTimeOff} className="mt-5 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={fieldLabel}>From</span>
                <input
                  type="datetime-local"
                  required
                  value={offForm.start}
                  onChange={(e) => setOffForm({ ...offForm, start: e.target.value })}
                  className="field"
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>To</span>
                <input
                  type="datetime-local"
                  required
                  value={offForm.end}
                  onChange={(e) => setOffForm({ ...offForm, end: e.target.value })}
                  className="field"
                />
              </label>
            </div>
            <label className="block">
              <span className={fieldLabel}>Reason (optional)</span>
              <input
                placeholder="Reason (optional)"
                value={offForm.reason}
                onChange={(e) => setOffForm({ ...offForm, reason: e.target.value })}
                className="field"
              />
            </label>
            <button className="btn-primary justify-self-start">
              <Plus size={15} /> Request time off
            </button>
          </form>

          <div className="rule-fade my-6" />

          <ul className="grid gap-2">
            {(timeOff.data?.timeOff ?? []).map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
                style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }}
              >
                <span data-numeric>
                  {new Date(t.startAt).toLocaleDateString()} →{' '}
                  {new Date(t.endAt).toLocaleDateString()}
                </span>
                <span className={t.status === 'approved' ? 'badge-live' : 'badge-quiet'}>
                  {t.status}
                </span>
              </li>
            ))}
            {!timeOff.data?.timeOff.length && (
              <li className="muted text-sm">No requests on file.</li>
            )}
          </ul>
        </section>

        <section className="card p-6 sm:p-7">
          <h2 className="font-display text-2xl">Earnings (month)</h2>
          {earnings.data ? (
            <>
              <p className="font-display mt-5 text-5xl text-brass-200" data-numeric>
                {peso(earnings.data.earnings)}
              </p>
              <p className="muted mt-1 text-sm">Take-home so far this month</p>

              <div className="rule-fade my-6" />

              <dl className="grid gap-2.5">
                {(
                  [
                    ['Jobs', String(earnings.data.bookings)],
                    ['Revenue', peso(earnings.data.revenue)],
                    ['Commission', `${earnings.data.commissionRate}%`],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="flex items-baseline gap-3">
                    <dt className="text-sm text-ivory-dim">{label}</dt>
                    <span className="mb-1 h-px flex-1 border-b border-dotted border-ivory/15" />
                    <dd className="shrink-0 text-sm font-medium" data-numeric>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <div className="mt-5 grid gap-3">
              <div className="skeleton h-12 w-40" />
              <div className="skeleton h-20 w-full" />
              <span className="sr-only">Loading…</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
