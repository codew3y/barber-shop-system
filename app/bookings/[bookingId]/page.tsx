'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, Check, X } from 'lucide-react';
import { apiJson } from '@/lib/api-client';
import type { Booking } from '@/lib/types';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-sm text-ivory-dim">{label}</dt>
      <span className="mb-1 h-px flex-1 border-b border-dotted border-ivory/15" />
      <dd className="shrink-0 text-sm font-medium" data-numeric>
        {value}
      </dd>
    </div>
  );
}

export default function BookingConfirmationPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  const { data, isLoading, error } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => apiJson<{ booking: Booking }>(`/api/v1/bookings/${bookingId}`),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="skeleton h-56 rounded-[1.75rem]" />
        <div className="skeleton mt-6 h-40 rounded-2xl" />
        <span className="sr-only">Fetching your ticket…</span>
      </div>
    );
  }
  if (error) {
    return (
      <p role="alert" className="text-ember">
        {(error as Error).message}
      </p>
    );
  }
  const booking = data!.booking;
  const cancelled = booking.status === 'cancelled';

  return (
    <div className="mx-auto max-w-2xl">
      <section className="band relative overflow-hidden px-6 py-14 text-center sm:px-10">
        <span
          className={`rise rise-1 mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            cancelled ? 'text-ivory-dim' : 'text-ink-950'
          }`}
          style={
            cancelled
              ? { background: 'rgb(255 255 255 / 0.06)', boxShadow: 'inset 0 0 0 1px var(--line)' }
              : {
                  background: 'linear-gradient(180deg, var(--color-brass-400), var(--color-brass-500))',
                  boxShadow: 'var(--glow-brass)',
                }
          }
          aria-hidden
        >
          {cancelled ? <X size={22} /> : <Check size={24} strokeWidth={2.5} />}
        </span>

        <p className="eyebrow rise rise-2 mt-6">The ticket</p>
        <h1 className="font-display rise rise-2 mt-3 text-4xl sm:text-5xl">
          {cancelled ? 'Chair released' : 'Chair reserved'}
        </h1>
        <p className="rise rise-3 muted mt-3" data-numeric>
          {booking.service?.name} ·{' '}
          {new Date(booking.startAt).toLocaleString([], {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      </section>

      <div className="card mt-6">
        <dl className="grid gap-2.5">
          <Row label="Shop" value={booking.shop?.name} />
          <Row label="Service" value={booking.service?.name} />
          <Row
            label="Barber"
            value={`${booking.staff?.user.firstName} ${booking.staff?.user.lastName}`}
          />
          <Row
            label="Status"
            value={
              <span className={cancelled ? 'badge-quiet' : 'badge-live'}>{booking.status}</span>
            }
          />
          {booking.holdExpiresAt && booking.status === 'pending' && (
            <Row
              label="Hold expires"
              value={new Date(booking.holdExpiresAt).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            />
          )}
        </dl>
      </div>

      <h2 className="font-display mt-10 mb-4 text-xl">Word from the house</h2>
      {booking.notifications?.length ? (
        <ul className="grid gap-2">
          {booking.notifications.map((n) => (
            <li
              key={n.id}
              className="inset flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
            >
              <span className="text-ivory-dim">
                <span className="text-ivory">{n.channel}</span> · {n.type}
              </span>
              <span className="badge-quiet">{n.status}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted text-sm">No messages from the house yet.</p>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/dashboard" className="btn-primary" data-press>
          Track in dashboard
        </Link>
        <a href={`/api/v1/bookings/${bookingId}/ics`} className="btn-ghost" data-press>
          <CalendarPlus size={15} />
          Add to calendar
        </a>
        <Link href="/" className="btn-ghost" data-press>
          Book another
        </Link>
      </div>
    </div>
  );
}
