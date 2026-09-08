'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { apiJson } from '@/lib/api-client';
import type { TimeSlot } from '@/lib/types';

function todayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function MonthCalendar({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const [y, m] = value.split('-').map(Number);
    return { y, m: m - 1 };
  });
  const today = new Date().toISOString().slice(0, 10);
  const maxDate = useMemo(() => new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10), []);

  const firstDow = new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const title = new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  });

  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
          className="rounded border border-cream/20 px-2 py-0.5 hover:bg-cream/10"
          aria-label="Previous month"
        >
          ←
        </button>
        <p className="font-display text-lg" data-testid="cal-title">{title}</p>
        <button
          onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
          className="rounded border border-cream/20 px-2 py-0.5 hover:bg-cream/10"
          aria-label="Next month"
        >
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="py-1 text-xs text-cream/50">
            {w}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`b${i}`} />;
          const iso = toISO(cursor.y, cursor.m, day);
          const disabled = iso < today || iso > maxDate;
          const selected = iso === value;
          return (
            <button
              key={iso}
              data-testid={`day-${iso}`}
              disabled={disabled}
              onClick={() => onChange(iso)}
              className={`rounded py-1.5 text-sm font-medium ${
                selected
                  ? 'bg-copper-600 text-cream'
                  : disabled
                    ? 'cursor-not-allowed text-cream/25'
                    : 'hover:bg-cream/10'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
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
      <div className="grid items-start gap-5 sm:grid-cols-2">
        {/* Left: calendar */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-widest text-copper-200">
            <CalendarDays size={14} /> DATE
          </p>
          <MonthCalendar value={date} onChange={setDate} />
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
                    className={`rounded border px-1 py-1.5 text-sm font-medium transition-all duration-150 ${
                      selected?.startTime === slot.startTime
                        ? 'border-copper-500 bg-copper-600 text-cream shadow-lg shadow-copper-600/30'
                        : slot.available
                          ? 'border-cream/15 bg-pine-950 hover:-translate-y-0.5 hover:border-copper-500 hover:shadow-md hover:shadow-copper-600/20'
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
