'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiJson } from '@/lib/api-client';
import type { Booking } from '@/lib/types';

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

  if (isLoading) return <p className="text-cream/60">Fetching your ticket…</p>;
  if (error) return <p className="text-red-300">{(error as Error).message}</p>;
  const booking = data!.booking;

  return (
    <div>
      <section className="band px-6 py-10 text-center">
        <p className="text-xs font-semibold tracking-widest text-copper-200">THE TICKET</p>
        <h1 className="font-display mt-1 text-4xl">
          {booking.status === 'cancelled' ? 'Chair released' : 'Chair reserved 🎉'}
        </h1>
        <p className="mt-2 text-cream/70">
          {booking.service?.name} · {new Date(booking.startAt).toLocaleString()}
        </p>
      </section>

      <div className="card mt-6">
        <dl className="grid gap-1 text-sm">
          <div className="flex justify-between"><dt className="text-cream/60">Shop</dt><dd className="font-medium">{booking.shop?.name}</dd></div>
          <div className="flex justify-between"><dt className="text-cream/60">Service</dt><dd className="font-medium">{booking.service?.name}</dd></div>
          <div className="flex justify-between">
            <dt className="text-cream/60">Barber</dt>
            <dd className="font-medium">{booking.staff?.user.firstName} {booking.staff?.user.lastName}</dd>
          </div>
          <div className="flex justify-between"><dt className="text-cream/60">Status</dt><dd className="font-medium">{booking.status}</dd></div>
          {booking.holdExpiresAt && booking.status === 'pending' && (
            <div className="flex justify-between"><dt className="text-cream/60">Hold expires</dt><dd>{new Date(booking.holdExpiresAt).toLocaleString()}</dd></div>
          )}
        </dl>
      </div>

      <h2 className="font-display mb-2 mt-6 text-xl">Word from the house</h2>
      {booking.notifications?.length ? (
        <ul className="mb-6 grid gap-2">
          {booking.notifications.map((n) => (
            <li key={n.id} className="flex justify-between rounded-xl border border-cream/10 bg-pine-900 px-3 py-2 text-sm">
              <span>{n.channel} · {n.type}</span>
              <span className="text-cream/60">{n.status}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-6 text-sm text-cream/60">No messages from the house yet.</p>
      )}

      <div className="flex gap-3">
        <Link href="/dashboard" className="btn-primary">
          Track in dashboard
        </Link>
        <Link href="/" className="btn-ghost">
          Book another
        </Link>
      </div>
    </div>
  );
}
