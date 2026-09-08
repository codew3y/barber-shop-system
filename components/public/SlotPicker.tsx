'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { apiJson } from '@/lib/api-client';
import type { TimeSlot } from '@/lib/types';

function todayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export function SlotPicker({
  shopId,
  staffId,
  serviceId,
  barberName,
  selected,
  onSelect,
}: {
  shopId: string;
  staffId: string;
  serviceId: string;
  barberName?: string;
  selected?: TimeSlot | null;
  onSelect: (s: TimeSlot) => void;
}) {
  const [date, setDate] = useState(todayISO());
  const { data, isLoading } = useQuery({
    queryKey: ['availability', shopId, staffId, serviceId, date],
    queryFn: () =>
      apiJson<{ slots: TimeSlot[] }>(
        `/api/v1/shops/${shopId}/staff/${staffId}/availability?date=${date}&serviceId=${serviceId}`
      ),
  });

  const available = (data?.slots ?? []).filter((s) => s.available);

  return (
    <div>
      <label className="card mb-4 block cursor-pointer">
        <span className="flex items-center gap-2 text-xs font-semibold tracking-widest text-copper-200">
          <CalendarDays size={14} /> PICK A DATE
        </span>
        <span className="font-display mt-1 block text-2xl">{prettyDate(date)}</span>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="field mt-3 w-full text-lg"
        />
      </label>

      <h3 className="font-display mb-2 text-xl">
        {barberName ? `${barberName}'s open chairs` : 'Open chairs'}
      </h3>
      {isLoading ? (
        <p className="text-cream/60">Checking the books…</p>
      ) : available.length === 0 ? (
        <p className="text-cream/60">No open chairs this date — try another day.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {data?.slots.map((slot) => (
            <button
              key={slot.startTime}
              disabled={!slot.available}
              onClick={() => onSelect(slot)}
              className={`rounded border px-2 py-2 text-base font-medium ${
                selected?.startTime === slot.startTime
                  ? 'border-copper-500 bg-copper-600 text-cream'
                  : slot.available
                    ? 'border-cream/15 bg-pine-900 hover:border-copper-500'
                    : 'cursor-not-allowed border-cream/10 text-cream/40 line-through'
              }`}
            >
              {new Date(slot.startTime).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
