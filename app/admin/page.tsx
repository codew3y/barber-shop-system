'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, X } from 'lucide-react';
import { apiFetch, apiJson } from '@/lib/api-client';
import { useAuthStore } from '@/stores/authStore';
import { Tabs } from '@/components/ui/Tabs';
import { customerName, peso } from '@/lib/format';

type Tab = 'overview' | 'bookings' | 'staff' | 'services' | 'settings';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'bookings', label: 'Bookings' },
  { value: 'staff', label: 'Staff' },
  { value: 'services', label: 'Services' },
  { value: 'settings', label: 'Settings' },
] as const satisfies readonly { value: Tab; label: string }[];

function useShopId() {
  const { data } = useQuery({
    queryKey: ['admin-shop'],
    queryFn: () => apiJson<{ shops: { id: string; name: string }[] }>('/api/v1/shops?limit=1'),
    staleTime: 5 * 60_000,
  });
  return data?.shops[0];
}

/** Row shell shared by every list in the console. */
function ListRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="inset flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm">
      {children}
    </li>
  );
}

function SectionHeading({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <h3 className="font-display text-lg">{children}</h3>
      <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
      {hint && (
        <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-ivory-dim/65">{hint}</span>
      )}
    </div>
  );
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

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
        <span className="sr-only">Crunching numbers…</span>
      </div>
    );
  }
  if (!data)
    return (
      <p role="alert" className="text-sm text-ember">
        Failed to load analytics.
      </p>
    );

  const cards: [string, string, string][] = [
    ['Revenue', peso(data.revenue), 'Last 30 days'],
    ['Bookings', String(data.bookings), 'Last 30 days'],
    ['No-show rate', `${(data.noShowRate * 100).toFixed(1)}%`, 'Lower is better'],
    ['Chair utilization', `${(data.utilization * 100).toFixed(1)}%`, 'Of bookable hours'],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(([label, value, hint]) => (
        <div key={label} className="inset rounded-2xl px-5 py-5">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-ivory-dim/65">
            {label}
          </p>
          <p className="font-display mt-2.5 text-3xl text-brass-200" data-numeric>
            {value}
          </p>
          <p className="mt-1 text-xs text-ivory-dim/70">{hint}</p>
        </div>
      ))}
      <div className="inset rounded-2xl px-5 py-5 sm:col-span-2 lg:col-span-4">
        <p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-ivory-dim/65">
          By status
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(data.byStatus).length === 0 ? (
            <span className="muted text-sm">—</span>
          ) : (
            Object.entries(data.byStatus).map(([k, v]) => (
              <span key={k} className="badge-quiet">
                {k}
                <span className="text-brass-300" data-numeric>
                  {v}
                </span>
              </span>
            ))
          )}
        </div>
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
      apiJson<{ bookings: { id: string; status: string; startAt: string; service: { name: string }; customer: { firstName: string; lastName: string; isGuest?: boolean }; staff: { user: { firstName: string; lastName: string } } }[] }>(
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
      <SectionHeading hint={`${data?.bookings.length ?? 0} on the day`}>Day sheet</SectionHeading>
      <label className="mb-5 block max-w-56">
        <span className="mb-2 block text-[0.6875rem] uppercase tracking-[0.14em] text-ivory-dim/70">
          Date
        </span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
      </label>
      <ul className="grid gap-2">
        {(data?.bookings ?? []).map((b) => (
          <ListRow key={b.id}>
            <span className="flex min-w-0 items-center gap-3">
              <span className="font-display shrink-0 text-base text-brass-200" data-numeric>
                {new Date(b.startAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{b.service.name}</span>
                <span className="block truncate text-xs text-ivory-dim/75">
                  {customerName(b.customer)} · with {b.staff.user.firstName}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="badge-quiet">{b.status}</span>
              {(b.status === 'pending' || b.status === 'confirmed') && (
                <button onClick={() => cancel(b.id)} className="btn-quiet">
                  Cancel
                </button>
              )}
            </span>
          </ListRow>
        ))}
      </ul>
      {!data?.bookings.length && (
        <div className="inset rounded-xl px-4 py-10 text-center">
          <p className="muted text-sm">No bookings this day.</p>
        </div>
      )}
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

  const pending = (timeOffQ.data?.timeOff ?? []).filter((t) => t.status === 'pending');

  return (
    <div className="grid gap-10">
      {error && (
        <p role="alert" className="text-sm text-ember">
          {error}
        </p>
      )}
      <div>
        <SectionHeading hint={`${staffQ.data?.staff.length ?? 0} on the roster`}>Roster</SectionHeading>
        <ul className="grid gap-2">
          {(staffQ.data?.staff ?? []).map((s) => (
            <ListRow key={s.id}>
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm text-brass-300"
                  style={{
                    background: 'rgb(196 160 72 / 0.13)',
                    boxShadow: 'inset 0 0 0 1px rgb(196 160 72 / 0.26)',
                  }}
                  aria-hidden
                >
                  {s.user.firstName.charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {s.user.firstName} {s.user.lastName}
                  </span>
                  <span className="block truncate text-xs text-ivory-dim/75">
                    {s.title ?? '—'} · <span data-numeric>{Number(s.commissionRate)}%</span> commission
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={s.isActive ? 'badge-live' : 'badge-quiet'}>
                  {s.isActive ? 'active' : 'inactive'}
                </span>
                {s.isActive && (
                  <button onClick={() => deactivate(s.id)} className="btn-quiet">
                    Deactivate
                  </button>
                )}
              </span>
            </ListRow>
          ))}
        </ul>
      </div>

      <div>
        <SectionHeading hint={`${pending.length} pending`}>Time-off approvals</SectionHeading>
        <ul className="grid gap-2">
          {pending.map((t) => (
            <ListRow key={t.id}>
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {t.staff.user.firstName} {t.staff.user.lastName}
                </span>
                <span className="block text-xs text-ivory-dim/75" data-numeric>
                  {new Date(t.startAt).toLocaleDateString()} → {new Date(t.endAt).toLocaleDateString()}
                </span>
              </span>
              <span className="flex shrink-0 gap-2">
                <button onClick={() => review(t.id, 'approved')} className="btn-quiet">
                  <Check size={13} /> Approve
                </button>
                <button onClick={() => review(t.id, 'rejected')} className="btn-quiet">
                  <X size={13} /> Reject
                </button>
              </span>
            </ListRow>
          ))}
        </ul>
        {pending.length === 0 && (
          <div className="inset rounded-xl px-4 py-8 text-center">
            <p className="muted text-sm">Nothing pending.</p>
          </div>
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
    <div className="grid gap-10">
      {error && (
        <p role="alert" className="text-sm text-ember">
          {error}
        </p>
      )}

      <div>
        <SectionHeading>Add to the menu</SectionHeading>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <input placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" />
          <input placeholder="Price (₱)" required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="field" />
          <input placeholder="Minutes" required type="number" min="1" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className="field" />
          <button className="btn-primary">
            <Plus size={15} /> Add service
          </button>
        </form>
      </div>

      <div>
        <SectionHeading hint={`${servicesQ.data?.services.length ?? 0} total`}>The menu</SectionHeading>
        <ul className="grid gap-2">
          {(servicesQ.data?.services ?? []).map((s) => (
            <ListRow key={s.id}>
              <span className="min-w-0">
                <span className="block truncate font-medium">{s.name}</span>
                <span className="block text-xs text-ivory-dim/75" data-numeric>
                  {peso(s.price)} · {s.durationMinutes} min
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={s.isActive ? 'badge-live' : 'badge-quiet'}>
                  {s.isActive ? 'active' : 'inactive'}
                </span>
                <button onClick={() => toggle(s)} className="btn-quiet">
                  {s.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </span>
            </ListRow>
          ))}
        </ul>
      </div>
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

  const label = 'mb-2 block text-[0.6875rem] uppercase tracking-[0.14em] text-ivory-dim/70';

  return (
    <div>
      <SectionHeading>Shop details</SectionHeading>
      <form onSubmit={save} className="grid max-w-lg gap-4">
        <label className="block">
          <span className={label}>Shop name</span>
          <input placeholder="Shop name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" />
        </label>
        <label className="block">
          <span className={label}>Phone</span>
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="field" />
        </label>
        <label className="block">
          <span className={label}>Description</span>
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="field" />
        </label>
        <div className="flex items-center gap-3">
          <button className="btn-primary">Save settings</button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-sage">
              <Check size={15} /> Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

export default function AdminPage() {
  const { user, ready } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const shop = useShopId();

  if (!ready) return <div className="skeleton h-64 rounded-2xl" />;
  if (!user) {
    router.push('/login');
    return <div className="skeleton h-64 rounded-2xl" />;
  }
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return (
      <div className="card mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl">Admin only</h1>
        <p className="muted mt-2 text-sm">This console is restricted to shop administrators.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">The office</p>
          <h1 className="font-display mt-3 text-4xl sm:text-5xl">Admin dashboard</h1>
          {shop && <p className="muted mt-2 text-sm">{shop.name}</p>}
        </div>
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Admin sections" />
      </div>

      {!shop ? (
        <div className="skeleton mt-8 h-64 rounded-2xl" />
      ) : (
        <section className="card mt-8 p-6 sm:p-7">
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
