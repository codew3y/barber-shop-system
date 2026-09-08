'use client';

import { useQuery } from '@tanstack/react-query';
import { apiJson } from '@/lib/api-client';
import type { StaffMember } from '@/lib/types';

export function StaffPicker({
  shopId,
  selected,
  onSelect,
}: {
  shopId: string;
  selected?: StaffMember | null;
  onSelect: (s: StaffMember) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['staff', shopId],
    queryFn: () => apiJson<{ staff: StaffMember[] }>(`/api/v1/shops/${shopId}/staff`),
  });

  if (isLoading) return <p>Loading barbers…</p>;
  return (
    <div className="grid gap-3">
      {data?.staff.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className={`pickable ${selected?.id === s.id ? 'pickable-selected' : ''}`}
        >
          <span className="font-medium">
            {s.user.firstName} {s.user.lastName}
          </span>
          {s.specialties.length > 0 && (
            <p className="text-sm text-zinc-500">{s.specialties.join(', ')}</p>
          )}
        </button>
      ))}
    </div>
  );
}
