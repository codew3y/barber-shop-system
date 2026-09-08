'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiJson } from '@/lib/api-client';
import type { Shop } from '@/lib/types';

export function ShopBrowser() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['shops'],
    queryFn: () => apiJson<{ shops: Shop[] }>('/api/v1/shops?limit=20'),
  });

  if (isLoading) return <p className="text-bark">Polishing the chairs…</p>;
  if (error) return <p className="text-red-700">Failed to load shops: {(error as Error).message}</p>;
  if (!data?.shops.length) return <p className="text-bark">No shops on the books yet.</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {data.shops.map((shop) => (
        <Link
          key={shop.id}
          href={`/shops/${shop.id}`}
          className="group rounded-2xl border border-espresso/10 bg-white/70 p-5 transition hover:-translate-y-0.5 hover:border-copper-500/50 hover:shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display flex h-11 w-11 items-center justify-center rounded-full bg-pine-900 text-lg text-copper-200">
              {shop.name.charAt(0)}
            </span>
            <span className="rounded-full bg-pine-50 px-3 py-1 text-xs font-medium text-pine-800">
              {shop.city}, {shop.state}
            </span>
          </div>
          <h2 className="font-display text-xl group-hover:underline">{shop.name}</h2>
          {shop.description && (
            <p className="mt-1 line-clamp-2 text-sm text-bark">{shop.description}</p>
          )}
          <p className="mt-3 text-sm font-medium text-copper-700">View services & barbers →</p>
        </Link>
      ))}
    </div>
  );
}
