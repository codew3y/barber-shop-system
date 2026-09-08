'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiJson } from '@/lib/api-client';
import type { TimeSlot } from '@/lib/types';

function todayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function SlotPicker({
  shopId,
  staffId,
  serviceId,
  selected,
  onSelect,
}: {
  shopId: string;
  staffId: string;
  serviceId: string;
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

  return (
    <div>
      <label className="mb-2 block text-sm font-medium">
        Date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="field mt-1 block"
        />
      </label>
      {isLoading ? (
        <p>Loading slots…</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {data?.slots.map((slot) => (
            <button
              key={slot.startTime}
              disabled={!slot.available}
              onClick={() => onSelect(slot)}
              className={`rounded-none border px-2 py-1.5 text-sm font-medium ${
                selected?.startTime === slot.startTime
                  ? 'border-copper-500 bg-copper-600 text-cream'
                  : slot.available
                    ? 'border-cream/15 bg-pine-900 hover:border-copper-500'
                    : 'cursor-not-allowed border-cream/10 text-cream/40'
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
