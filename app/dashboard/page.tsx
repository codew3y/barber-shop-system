'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, CalendarX2 } from 'lucide-react';
import { apiFetch, apiJson } from '@/lib/api-client';
import { useAuthStore } from '@/stores/authStore';
import { HoldButton } from '@/components/hold-button';
import { toast } from 'sonner';
import type { Booking } from '@/lib/types';

function PageSkeleton({ note }: { note: string }) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton mt-4 h-10 w-56" />
      <div className="mt-8 grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
      <span className="sr-only">{note}</span>
    </div>
  );
}

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

  if (!ready) return <PageSkeleton note="Sweeping the floor…" />;
  if (!user) return <PageSkeleton note="Redirecting to login…" />;
  if (isLoading) return <PageSkeleton note="Fetching your tickets…" />;

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
      const message = (d as { error?: string }).error ?? 'Cancel failed';
      setError(message);
      toast.error(message);
      return;
    }
    toast.success('Chair released.');
    queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
  }

  function BookingCard({ b }: { b: Booking }) {
    const active = b.status === 'pending' || b.status === 'confirmed';
    const when = new Date(b.startAt);
    return (
      <li className="card lift-hover flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Date block — the thing you scan for */}
        <div
          className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl"
          style={{
            background: 'rgb(196 160 72 / 0.1)',
            boxShadow: 'inset 0 0 0 1px rgb(196 160 72 / 0.22)',
          }}
          aria-hidden
        >
          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-brass-400">
            {when.toLocaleDateString([], { month: 'short' })}
          </span>
          <span className="font-display text-2xl text-brass-200" data-numeric>
            {when.getDate()}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/bookings/${b.id}`}
              className="font-display group inline-flex items-center gap-1.5 text-lg text-ivory transition-colors duration-200 hover:text-brass-200"
            >
              {b.service?.name}
              <ArrowUpRight
                size={15}
                className="nudge-diag text-brass-400"
              />
            </Link>
            <span className={active ? 'badge-live' : 'badge-quiet'}>{b.status}</span>
          </div>
          <p className="muted mt-1 text-sm" data-numeric>
            {when.toLocaleString([], {
              weekday: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}{' '}
            · {b.staff?.user.firstName} {b.staff?.user.lastName} · {b.shop?.name}
          </p>
        </div>

          {active && (
            <div className="shrink-0 self-start sm:self-center">
              <HoldButton onConfirm={() => cancel(b.id)}>Hold to release</HoldButton>
            </div>
          )}
      </li>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <p className="eyebrow">The ledger</p>
      <h1 className="font-display mt-3 text-4xl sm:text-5xl">My chairs</h1>
      {error && (
        <p role="alert" className="mt-4 text-sm text-ember">
          {error}
        </p>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="font-display text-xl">Upcoming ({upcoming.length})</h2>
          <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
        </div>
        {upcoming.length === 0 ? (
          <div className="inset rounded-2xl px-6 py-10 text-center">
            <p className="font-display text-lg">Nothing on the books</p>
            <p className="muted mt-1.5 text-sm">
              <Link href="/" className="text-brass-300 hover:text-brass-200">
                Take a chair
              </Link>{' '}
              and it will show up here.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {upcoming.map((b) => (
              <BookingCard key={b.id} b={b} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="font-display text-xl">History ({past.length})</h2>
          <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
        </div>
        {past.length === 0 ? (
          <p className="muted text-sm">No past visits yet.</p>
        ) : (
          <ul className="grid gap-3">
            {past.map((b) => (
              <BookingCard key={b.id} b={b} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
