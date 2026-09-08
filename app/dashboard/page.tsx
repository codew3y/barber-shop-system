'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (ready && !user) router.push('/login');
  }, [ready, user, router]);

  if (!ready) return <p className="text-cream/60">Sweeping the floor…</p>;
  if (!user) return <p className="text-cream/60">Redirecting to login…</p>;
  if (isLoading) return <p className="text-cream/60">Fetching your tickets…</p>;

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
    const active = b.status === 'pending' || b.status === 'confirmed';
    return (
      <li className="rounded-2xl border border-cream/10 bg-pine-900 p-4">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/bookings/${b.id}`} className="font-medium text-cream hover:underline">
            {b.service?.name} at {b.shop?.name}
          </Link>
          <span className={`shrink-0 rounded-none px-2 py-0.5 text-xs font-medium ${active ? 'bg-copper-600/20 text-copper-200' : 'bg-cream/10 text-cream/60'}`}>{b.status}</span>
        </div>
        <p className="mt-1 text-sm text-cream/60">
          {new Date(b.startAt).toLocaleString()} · {b.staff?.user.firstName} {b.staff?.user.lastName}
        </p>
        {active && (
          <button onClick={() => cancel(b.id)} className="mt-3 rounded-none border border-cream/20 px-3 py-1 text-sm text-cream hover:bg-cream/10">
            Release chair
          </button>
        )}
      </li>
    );
  }

  return (
    <div className="rounded-3xl border border-cream/10 bg-pine-900 px-5 py-8 text-cream sm:px-8">
      <p className="text-xs font-semibold tracking-widest text-copper-200">THE LEDGER</p>
      <h1 className="font-display mb-4 text-3xl">My chairs</h1>
      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
      <h2 className="font-display mb-2 text-xl text-cream/90">Upcoming ({upcoming.length})</h2>
      {upcoming.length === 0 ? (
        <p className="mb-6 text-sm text-cream/60">Nothing on the books. <Link href="/" className="text-copper-200 underline">Take a chair</Link>.</p>
      ) : (
        <ul className="mb-8 grid gap-3">{upcoming.map((b) => <BookingCard key={b.id} b={b} />)}</ul>
      )}
      <h2 className="font-display mb-2 text-xl text-cream/90">History ({past.length})</h2>
      {past.length === 0 ? (
        <p className="text-sm text-cream/60">No past visits yet.</p>
      ) : (
        <ul className="grid gap-3">{past.map((b) => <BookingCard key={b.id} b={b} />)}</ul>
      )}
    </div>
  );
}
