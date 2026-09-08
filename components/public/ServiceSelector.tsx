'use client';

import { useQuery } from '@tanstack/react-query';
import { apiJson } from '@/lib/api-client';
import type { Service } from '@/lib/types';

export function ServiceSelector({
  shopId,
  selected,
  onSelect,
}: {
  shopId: string;
  selected?: Service | null;
  onSelect: (s: Service) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['services', shopId],
    queryFn: () => apiJson<{ services: Service[] }>(`/api/v1/shops/${shopId}/services`),
  });

  if (isLoading) return <p>Loading services…</p>;
  return (
    <div className="grid gap-3">
      {data?.services.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className={`pickable ${selected?.id === s.id ? 'pickable-selected' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{s.name}</span>
            <span>${Number(s.price).toFixed(2)}</span>
          </div>
          <p className="text-sm text-zinc-500">
            {s.durationMinutes} min{s.category ? ` · ${s.category}` : ''}
          </p>
        </button>
      ))}
    </div>
  );
}
