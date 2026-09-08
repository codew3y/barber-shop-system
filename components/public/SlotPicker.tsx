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
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
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
    <div className="card">
      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        {/* Left: date */}
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-copper-200">
            <CalendarDays size={14} /> DATE
          </p>
          <p className="font-display mt-1 text-xl">{prettyDate(date)}</p>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="field mt-2 w-full"
          />
        </div>
        {/* Right: times */}
        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-copper-200">
            {barberName ? `${barberName.toUpperCase()}'S TIME` : 'TIME'}
          </p>
          {isLoading ? (
            <p className="text-sm text-cream/60">Checking the books…</p>
          ) : available.length === 0 ? (
            <p className="text-sm text-cream/60">Fully booked — try another day.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {(data?.slots ?? []).map((slot) => {
                const time = new Date(slot.startTime).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                });
                return (
                  <button
                    key={slot.startTime}
                    disabled={!slot.available}
                    onClick={() => onSelect(slot)}
                    className={`rounded border px-1 py-1.5 text-sm font-medium ${
                      selected?.startTime === slot.startTime
                        ? 'border-copper-500 bg-copper-600 text-cream'
                        : slot.available
                          ? 'border-cream/15 bg-pine-950 hover:border-copper-500'
                          : 'cursor-not-allowed border-cream/10 text-cream/40'
                    }`}
                  >
                    <span className={slot.available ? '' : 'line-through'}>{time}</span>
                    {!slot.available && (
                      <span className="block text-[10px] font-normal">unavailable</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
