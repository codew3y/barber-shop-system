'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [maxDate] = useState(() => new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10));

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

  const arrow =
    'flex h-8 w-8 items-center justify-center rounded-full text-ivory-dim transition-colors duration-200 hover:bg-ivory/8 hover:text-ivory';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
          className={arrow}
          aria-label="Previous month"
        >
          <ChevronLeft size={17} />
        </button>
        <p className="font-display text-lg" data-testid="cal-title">
          {title}
        </p>
        <button
          onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
          className={arrow}
          aria-label="Next month"
        >
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <span
            key={i}
            className="pb-2 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ivory-dim/60"
          >
            {w}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`b${i}`} />;
          const iso = toISO(cursor.y, cursor.m, day);
          const disabled = iso < today || iso > maxDate;
          const selected = iso === value;
          const isToday = iso === today;
          return (
            <button
              key={iso}
              data-testid={`day-${iso}`}
              disabled={disabled}
              aria-current={selected ? 'date' : undefined}
              onClick={() => onChange(iso)}
              className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-[background-color,color,box-shadow] duration-200 ${
                selected
                  ? 'text-ink-950'
                  : disabled
                    ? 'cursor-not-allowed text-ivory-dim/30'
                    : 'text-ivory hover:bg-ivory/8'
              }`}
              style={
                selected
                  ? {
                      background:
                        'linear-gradient(180deg, var(--color-brass-400), var(--color-brass-500))',
                      boxShadow: 'var(--glow-brass)',
                    }
                  : undefined
              }
            >
              <span data-numeric>{day}</span>
              {isToday && !selected && (
                <span
                  aria-hidden
                  className="absolute bottom-1 h-1 w-1 rounded-full bg-brass-400"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Morning / afternoon / evening, so a long day of slots stays scannable. */
function partOfDay(iso: string, timeZone?: string): 'Morning' | 'Afternoon' | 'Evening' {
  const hour = Number(
    new Date(iso).toLocaleString('en-US', { hour: 'numeric', hour12: false, ...(timeZone ? { timeZone } : {}) })
  );
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
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
      apiJson<{ slots: TimeSlot[]; timeZone: string }>(
        `/api/v1/shops/${shopId}/staff/${staffId}/availability?date=${date}&serviceId=${serviceId}`
      ),
  });

  const timeZone = data?.timeZone;
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      ...(timeZone ? { timeZone } : {}),
    });

  const slots = data?.slots ?? [];
  const available = slots.filter((s) => s.available);

  const groups = (['Morning', 'Afternoon', 'Evening'] as const)
    .map((label) => ({ label, items: slots.filter((s) => partOfDay(s.startTime, timeZone) === label) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="card">
      <div className="grid items-start gap-8 sm:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        {/* Left: calendar */}
        <div>
          <p className="eyebrow mb-4">
            <CalendarDays size={13} /> Date
          </p>
          <MonthCalendar value={date} onChange={setDate} />
        </div>

        {/* Right: times */}
        <div>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <p className="eyebrow">{barberName ? `${barberName}'s time` : 'Time'}</p>
            {!isLoading && (
              <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-ivory-dim/65">
                <span data-numeric>{available.length}</span> open
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="skeleton h-10 rounded-lg" />
              ))}
              <span className="sr-only">Checking the books…</span>
            </div>
          ) : available.length === 0 ? (
            <div className="inset rounded-xl px-4 py-10 text-center">
              <p className="font-display text-lg">Fully booked</p>
              <p className="muted mt-1 text-sm">Try another day on the calendar.</p>
            </div>
          ) : (
            <div className="grid gap-5">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="mb-2.5 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-ivory-dim/60">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {group.items.map((slot) => {
                      const time = fmtTime(slot.startTime);
                      const isSelected = selected?.startTime === slot.startTime;
                      return (
                        <button
                          key={slot.startTime}
                          disabled={!slot.available}
                          aria-pressed={isSelected}
                          onClick={() => onSelect(slot)}
                          className={`rounded-lg px-1 py-2.5 text-sm font-medium transition-[background-color,border-color,box-shadow,translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                            isSelected
                              ? 'text-ink-950'
                              : slot.available
                                ? 'inset slot-hover text-ivory'
                                : 'inset cursor-not-allowed text-ivory-dim/40'
                          }`}
                          style={
                            isSelected
                              ? {
                                  background:
                                    'linear-gradient(180deg, var(--color-brass-400), var(--color-brass-500))',
                                  boxShadow: 'var(--glow-brass)',
                                }
                              : undefined
                          }
                        >
                          <span className={slot.available ? '' : 'line-through'} data-numeric>
                            {time}
                          </span>
                          {!slot.available && (
                            <span className="block text-[0.625rem] font-normal">taken</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
