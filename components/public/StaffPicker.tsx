'use client';

import { useQuery } from '@tanstack/react-query';
import { apiJson } from '@/lib/api-client';
import type { StaffMember } from '@/lib/types';

export function StaffPicker({
  shopId,
  serviceId,
  selected,
  onSelect,
}: {
  shopId: string;
  serviceId?: string | null;
  selected?: StaffMember | null;
  onSelect: (s: StaffMember) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['staff', shopId],
    queryFn: () => apiJson<{ staff: StaffMember[] }>(`/api/v1/shops/${shopId}/staff`),
  });

  const list = (data?.staff ?? []).filter(
    (s) => !serviceId || (s.services ?? []).some((x) => x.service.id === serviceId)
  );

  if (isLoading) return <p>Loading barbers…</p>;
  if (list.length === 0) return <p className="text-cream/60">No barber offers this service — pick another.</p>;
  return (
    <div className="grid gap-3">
      {list.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className={`pickable ${selected?.id === s.id ? 'pickable-selected' : ''}`}
        >
          <span className="font-medium">
            {s.user.firstName} {s.user.lastName}
          </span>
          {s.specialties.length > 0 && (
            <p className="text-sm text-cream/60">{s.specialties.join(', ')}</p>
          )}
        </button>
      ))}
    </div>
  );
}
