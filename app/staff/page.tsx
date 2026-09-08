'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

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

  if (!ready) return <p className="text-cream/60">Loading…</p>;
  if (!user) {
    router.push('/login');
    return <p className="text-cream/60">Redirecting…</p>;
  }
  if (user.role !== 'staff' && user.role !== 'admin' && user.role !== 'super_admin') {
    return <p className="text-red-300">Staff only.</p>;
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
      <p className="text-xs font-semibold tracking-widest text-copper-200">THE CHAIR</p>
      <h1 className="font-display mb-4 text-3xl">Staff dashboard</h1>
      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      <section className="card mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">Day schedule</h2>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field text-sm" />
        </div>
        {schedule.isLoading ? (
          <p className="text-sm text-cream/60">Loading chairs…</p>
        ) : !schedule.data?.schedule.length ? (
          <p className="text-sm text-cream/60">No bookings this day.</p>
        ) : (
          <ul className="grid gap-2">
            {schedule.data.schedule.map((b) => (
              <li key={b.id} className="rounded border border-cream/10 bg-pine-950 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {new Date(b.startAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {b.service.name}
                  </span>
                  <span className="rounded bg-cream/10 px-2 py-0.5 text-xs">{b.status}</span>
                </div>
                <p className="text-sm text-cream/60">
                  {b.customer.firstName} {b.customer.lastName}
                  {b.customer.phone ? ` · ${b.customer.phone}` : ''}
                </p>
                {(NEXT_STATUS[b.status] ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {NEXT_STATUS[b.status].map((a) => (
                      <button
                        key={a.value}
                        onClick={() => setStatus(b.id, a.value)}
                        className="rounded border border-cream/20 px-2 py-1 text-xs hover:bg-cream/10"
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

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="card">
          <h2 className="font-display mb-3 text-xl">Time off</h2>
          <form onSubmit={requestTimeOff} className="mb-4 grid gap-2">
            <label className="text-sm">From <input type="datetime-local" required value={offForm.start} onChange={(e) => setOffForm({ ...offForm, start: e.target.value })} className="field mt-1 block w-full text-sm" /></label>
            <label className="text-sm">To <input type="datetime-local" required value={offForm.end} onChange={(e) => setOffForm({ ...offForm, end: e.target.value })} className="field mt-1 block w-full text-sm" /></label>
            <input placeholder="Reason (optional)" value={offForm.reason} onChange={(e) => setOffForm({ ...offForm, reason: e.target.value })} className="field text-sm" />
            <button className="btn-primary text-sm">Request time off</button>
          </form>
          <ul className="grid gap-1 text-sm">
            {(timeOff.data?.timeOff ?? []).map((t) => (
              <li key={t.id} className="flex justify-between rounded border border-cream/10 px-2 py-1">
                <span>{new Date(t.startAt).toLocaleDateString()} → {new Date(t.endAt).toLocaleDateString()}</span>
                <span className="text-cream/60">{t.status}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2 className="font-display mb-3 text-xl">Earnings (month)</h2>
          {earnings.data ? (
            <dl className="grid gap-1 text-sm">
              <div className="flex justify-between"><dt className="text-cream/60">Jobs</dt><dd>{earnings.data.bookings}</dd></div>
              <div className="flex justify-between"><dt className="text-cream/60">Revenue</dt><dd>{peso(earnings.data.revenue)}</dd></div>
              <div className="flex justify-between"><dt className="text-cream/60">Commission</dt><dd>{earnings.data.commissionRate}%</dd></div>
              <div className="flex justify-between font-medium"><dt>Take-home</dt><dd className="text-copper-200">{peso(earnings.data.earnings)}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-cream/60">Loading…</p>
          )}
        </section>
      </div>
    </div>
  );
}
