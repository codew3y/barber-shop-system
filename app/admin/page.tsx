'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiJson } from '@/lib/api-client';
import { useAuthStore } from '@/stores/authStore';
import { peso } from '@/lib/format';

type Tab = 'overview' | 'bookings' | 'staff' | 'services' | 'settings';

function useShopId() {
  const { data } = useQuery({
    queryKey: ['admin-shop'],
    queryFn: () => apiJson<{ shops: { id: string; name: string }[] }>('/api/v1/shops?limit=1'),
    staleTime: 5 * 60_000,
  });
  return data?.shops[0];
}

function Overview({ shopId }: { shopId: string }) {
  const [range] = useState(() => {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
    return { start, end };
  });
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics', shopId],
    queryFn: () =>
      apiJson<{
        revenue: string;
        bookings: number;
        byStatus: Record<string, number>;
        noShowRate: number;
        utilization: number;
      }>(`/api/v1/admin/analytics?shopId=${shopId}&startDate=${range.start}&endDate=${range.end}`),
  });
  if (isLoading) return <p className="text-sm text-cream/60">Crunching numbers…</p>;
  if (!data) return <p className="text-sm text-red-300">Failed to load analytics.</p>;
  const cards: [string, string][] = [
    ['Revenue (30d)', peso(data.revenue)],
    ['Bookings (30d)', String(data.bookings)],
    ['No-show rate', `${(data.noShowRate * 100).toFixed(1)}%`],
    ['Chair utilization', `${(data.utilization * 100).toFixed(1)}%`],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded border border-cream/10 bg-pine-950 p-4">
          <p className="text-xs tracking-widest text-cream/50">{label.toUpperCase()}</p>
          <p className="font-display text-2xl">{value}</p>
        </div>
      ))}
      <div className="rounded border border-cream/10 bg-pine-950 p-4 sm:col-span-4">
        <p className="text-xs tracking-widest text-cream/50">BY STATUS</p>
        <p className="text-sm">{Object.entries(data.byStatus).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}</p>
      </div>
    </div>
  );
}

function Bookings({ shopId }: { shopId: string }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { data } = useQuery({
    queryKey: ['admin-bookings', shopId, date],
    queryFn: () =>
      apiJson<{ bookings: { id: string; status: string; startAt: string; service: { name: string }; customer: { firstName: string; lastName: string }; staff: { user: { firstName: string; lastName: string } } }[] }>(
        `/api/v1/admin/bookings?shopId=${shopId}&date=${date}`
      ),
    refetchInterval: 15_000,
  });
  async function cancel(id: string) {
    await apiFetch(`/api/v1/bookings/${id}/cancel`, { method: 'PUT', body: '{}' });
    queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
  }
  return (
    <div>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field mb-3 text-sm" />
      <ul className="grid gap-2">
        {(data?.bookings ?? []).map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-2 rounded border border-cream/10 bg-pine-950 px-3 py-2 text-sm">
            <span>
              {new Date(b.startAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {b.service.name} · {b.customer.firstName} (w/ {b.staff.user.firstName})
            </span>
            <span className="flex items-center gap-2">
              <span className="text-cream/60">{b.status}</span>
              {(b.status === 'pending' || b.status === 'confirmed') && (
                <button onClick={() => cancel(b.id)} className="rounded border border-cream/20 px-2 py-0.5 text-xs hover:bg-cream/10">Cancel</button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {!data?.bookings.length && <p className="text-sm text-cream/60">No bookings this day.</p>}
    </div>
  );
}

function Staff({ shopId }: { shopId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const staffQ = useQuery({
    queryKey: ['admin-staff', shopId],
    queryFn: () =>
      apiJson<{ staff: { id: string; bio: string | null; title: string | null; isActive: boolean; commissionRate: string | number; user: { firstName: string; lastName: string; email: string } }[] }>(
        `/api/v1/admin/staff?shopId=${shopId}`
      ),
  });
  const timeOffQ = useQuery({
    queryKey: ['admin-timeoff', shopId],
    queryFn: () =>
      apiJson<{ timeOff: { id: string; startAt: string; endAt: string; status: string; staff: { user: { firstName: string; lastName: string } } }[] }>(
        `/api/v1/admin/time-off?shopId=${shopId}`
      ),
  });

  async function deactivate(id: string) {
    setError(null);
    const res = await apiFetch(`/api/v1/admin/staff/${id}`, { method: 'DELETE' });
    if (!res.ok) setError('Deactivate failed');
    queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
  }
  async function review(id: string, status: string) {
    const res = await apiFetch(`/api/v1/staff/time-off/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    if (!res.ok) setError('Review failed');
    queryClient.invalidateQueries({ queryKey: ['admin-timeoff'] });
  }

  return (
    <div className="grid gap-6">
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div>
        <h3 className="mb-2 font-medium">Roster</h3>
        <ul className="grid gap-2">
          {(staffQ.data?.staff ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded border border-cream/10 bg-pine-950 px-3 py-2 text-sm">
              <span>{s.user.firstName} {s.user.lastName} · {s.title ?? '—'} · {s.isActive ? 'active' : 'inactive'} · {Number(s.commissionRate)}% comm.</span>
              {s.isActive && (
                <button onClick={() => deactivate(s.id)} className="rounded border border-cream/20 px-2 py-0.5 text-xs hover:bg-cream/10">Deactivate</button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 font-medium">Time-off approvals</h3>
        <ul className="grid gap-2">
          {(timeOffQ.data?.timeOff ?? []).filter((t) => t.status === 'pending').map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 rounded border border-cream/10 bg-pine-950 px-3 py-2 text-sm">
              <span>{t.staff.user.firstName} {t.staff.user.lastName}: {new Date(t.startAt).toLocaleDateString()} → {new Date(t.endAt).toLocaleDateString()}</span>
              <span className="flex gap-2">
                <button onClick={() => review(t.id, 'approved')} className="rounded border border-cream/20 px-2 py-0.5 text-xs hover:bg-cream/10">Approve</button>
                <button onClick={() => review(t.id, 'rejected')} className="rounded border border-cream/20 px-2 py-0.5 text-xs hover:bg-cream/10">Reject</button>
              </span>
            </li>
          ))}
        </ul>
        {(timeOffQ.data?.timeOff ?? []).filter((t) => t.status === 'pending').length === 0 && (
          <p className="text-sm text-cream/60">Nothing pending.</p>
        )}
      </div>
    </div>
  );
}

function Services({ shopId }: { shopId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', price: '', durationMinutes: '30' });
  const servicesQ = useQuery({
    queryKey: ['admin-services', shopId],
    queryFn: () =>
      apiJson<{ services: { id: string; name: string; price: string | number; durationMinutes: number; isActive: boolean }[] }>(
        `/api/v1/admin/services?shopId=${shopId}`
      ),
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await apiFetch('/api/v1/admin/services', {
      method: 'POST',
      body: JSON.stringify({
        shopId,
        name: form.name,
        price: Number(form.price),
        durationMinutes: Number(form.durationMinutes),
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? 'Create failed');
      return;
    }
    setForm({ name: '', price: '', durationMinutes: '30' });
    queryClient.invalidateQueries({ queryKey: ['admin-services'] });
  }

  async function toggle(s: { id: string; isActive: boolean; name: string; price: string | number; durationMinutes: number }) {
    if (s.isActive) {
      await apiFetch(`/api/v1/admin/services/${s.id}`, { method: 'DELETE' });
    } else {
      await apiFetch(`/api/v1/admin/services/${s.id}`, { method: 'PUT', body: JSON.stringify({ isActive: true }) });
    }
    queryClient.invalidateQueries({ queryKey: ['admin-services'] });
  }

  return (
    <div className="grid gap-6">
      {error && <p className="text-sm text-red-300">{error}</p>}
      <form onSubmit={create} className="grid gap-2 sm:grid-cols-4">
        <input placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field text-sm" />
        <input placeholder="Price (₱)" required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="field text-sm" />
        <input placeholder="Minutes" required type="number" min="1" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className="field text-sm" />
        <button className="btn-primary text-sm">Add service</button>
      </form>
      <ul className="grid gap-2">
        {(servicesQ.data?.services ?? []).map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 rounded border border-cream/10 bg-pine-950 px-3 py-2 text-sm">
            <span>{s.name} · {peso(s.price)} · {s.durationMinutes} min · {s.isActive ? 'active' : 'inactive'}</span>
            <button onClick={() => toggle(s)} className="rounded border border-cream/20 px-2 py-0.5 text-xs hover:bg-cream/10">
              {s.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Settings({ shopId }: { shopId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', phone: '', description: '' });
  const [saved, setSaved] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    await apiFetch('/api/v1/admin/shop/settings', {
      method: 'PUT',
      body: JSON.stringify({
        shopId,
        settings: { updatedVia: 'admin-dashboard' },
        ...(form.name ? { name: form.name } : {}),
        ...(form.phone ? { phone: form.phone } : {}),
        ...(form.description ? { description: form.description } : {}),
      }),
    });
    setSaved(true);
    queryClient.invalidateQueries({ queryKey: ['shop-info'] });
  }
  return (
    <form onSubmit={save} className="grid max-w-md gap-2">
      <input placeholder="Shop name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field text-sm" />
      <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="field text-sm" />
      <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="field text-sm" />
      <button className="btn-primary text-sm">Save settings</button>
      {saved && <p className="text-sm text-cream/60">Saved.</p>}
    </form>
  );
}

export default function AdminPage() {
  const { user, ready } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const shop = useShopId();

  if (!ready) return <p className="text-cream/60">Loading…</p>;
  if (!user) {
    router.push('/login');
    return <p className="text-cream/60">Redirecting…</p>;
  }
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return <p className="text-red-300">Admin only.</p>;
  }

  const tabs: Tab[] = ['overview', 'bookings', 'staff', 'services', 'settings'];

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest text-copper-200">THE OFFICE</p>
      <h1 className="font-display mb-4 text-3xl">Admin dashboard</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${tab === t ? 'bg-copper-600 text-cream' : 'border border-cream/20 hover:bg-cream/10'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {!shop ? (
        <p className="text-sm text-cream/60">Loading shop…</p>
      ) : (
        <section className="card">
          {tab === 'overview' && <Overview shopId={shop.id} />}
          {tab === 'bookings' && <Bookings shopId={shop.id} />}
          {tab === 'staff' && <Staff shopId={shop.id} />}
          {tab === 'services' && <Services shopId={shop.id} />}
          {tab === 'settings' && <Settings shopId={shop.id} />}
        </section>
      )}
    </div>
  );
}
