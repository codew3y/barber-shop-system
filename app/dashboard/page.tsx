'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiJson } from '@/lib/api-client';
import { useAuthStore } from '@/stores/authStore';
import type { Booking } from '@/lib/types';

export default function DashboardPage() {
  const { user, ready } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => apiJson<{ bookings: Booking[] }>('/api/v1/bookings/mine?limit=50'),
    enabled: ready && !!user,
  });

  if (!ready) return <p className="text-bark">Sweeping the floor…</p>;
  if (!user) {
    router.push('/login');
    return <p>Redirecting to login…</p>;
  }
  if (isLoading) return <p className="text-bark">Fetching your tickets…</p>;

  const now = new Date();
  const upcoming = (data?.bookings ?? []).filter(
    (b) => new Date(b.startAt) >= now && (b.status === 'pending' || b.status === 'confirmed')
  );
  const past = (data?.bookings ?? []).filter((b) => !upcoming.includes(b));

  async function cancel(id: string) {
    setError(null);
    const res = await apiFetch(`/api/v1/bookings/${id}/cancel`, { method: 'PUT', body: '{}' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? 'Cancel failed');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
  }

  function BookingCard({ b }: { b: Booking }) {
    return (
      <li className="card">
        <div className="flex items-center justify-between">
          <Link href={`/bookings/${b.id}`} className="font-medium hover:underline">
            {b.service?.name} at {b.shop?.name}
          </Link>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.status === 'cancelled' ? 'bg-espresso/5 text-bark' : 'bg-pine-100 text-pine-800'}`}>{b.status}</span>
        </div>
        <p className="text-sm text-bark">
          {new Date(b.startAt).toLocaleString()} · {b.staff?.user.firstName} {b.staff?.user.lastName}
        </p>
        {(b.status === 'pending' || b.status === 'confirmed') && (
          <button onClick={() => cancel(b.id)} className="mt-2 rounded-full border border-espresso/20 px-3 py-1 text-sm hover:bg-parchment">
            Release chair
          </button>
        )}
      </li>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest text-copper-700">THE LEDGER</p>
      <h1 className="font-display mb-4 text-3xl">My chairs</h1>
      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
      <h2 className="font-display mb-2 text-xl">Upcoming ({upcoming.length})</h2>
      {upcoming.length === 0 ? (
        <p className="mb-6 text-sm text-bark">Nothing on the books. <Link href="/" className="text-copper-700 underline">Take a chair</Link>.</p>
      ) : (
        <ul className="mb-6 grid gap-3">{upcoming.map((b) => <BookingCard key={b.id} b={b} />)}</ul>
      )}
      <h2 className="font-display mb-2 text-xl">History ({past.length})</h2>
      <ul className="grid gap-3">{past.map((b) => <BookingCard key={b.id} b={b} />)}</ul>
    </div>
  );
}
