'use client';

import { useQuery } from '@tanstack/react-query';
import { apiJson } from '@/lib/api-client';
import type { Service, StaffMember } from '@/lib/types';

function offeredIds(staff: StaffMember | null | undefined): string[] {
  return (staff?.services ?? []).map((x) => x.service.id);
}

export function BarberServicePicker({
  shopId,
  service,
  staff,
  onSelectService,
  onSelectStaff,
}: {
  shopId: string;
  service: Service | null;
  staff: StaffMember | null;
  onSelectService: (s: Service) => void;
  onSelectStaff: (s: StaffMember) => void;
}) {
  const servicesQ = useQuery({
    queryKey: ['services', shopId],
    queryFn: () => apiJson<{ services: Service[] }>(`/api/v1/shops/${shopId}/services`),
  });
  const staffQ = useQuery({
    queryKey: ['staff', shopId],
    queryFn: () => apiJson<{ staff: StaffMember[] }>(`/api/v1/shops/${shopId}/staff`),
  });

  if (servicesQ.isLoading || staffQ.isLoading) {
    return <p className="text-cream/60">Loading chairs…</p>;
  }

  const services = servicesQ.data?.services ?? [];
  const barbers = staffQ.data?.staff ?? [];
  const staffServiceIds = offeredIds(staff);

  return (
    <div className="card">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Left: barbers */}
        <div>
          <h3 className="font-display mb-2 text-lg">Barber</h3>
          <div className="grid gap-2">
            {barbers.map((b) => {
              const unavailable = !!service && !offeredIds(b).includes(service.id);
              const selected = staff?.id === b.id;
              return (
                <button
                  key={b.id}
                  disabled={unavailable}
                  onClick={() => onSelectStaff(b)}
                  className={`rounded border p-2.5 text-left text-sm ${
                    selected
                      ? 'border-copper-500 bg-copper-600/15'
                      : unavailable
                        ? 'cursor-not-allowed border-cream/10 text-cream/40'
                        : 'border-cream/15 bg-pine-950 hover:border-copper-500/60'
                  }`}
                >
                  <span className={`font-medium ${unavailable ? 'line-through' : ''}`}>
                    {b.user.firstName} {b.user.lastName}
                  </span>
                  <span className="ml-2 text-xs text-cream/50">
                    {unavailable ? '· unavailable' : `· ${b.title ?? 'Hairstylist & Barber'}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {/* Right: services */}
        <div>
          <h3 className="font-display mb-2 text-lg">Service</h3>
          <div className="grid gap-2">
            {services.map((s) => {
              const unavailable = !!staff && !staffServiceIds.includes(s.id);
              const selected = service?.id === s.id;
              return (
                <button
                  key={s.id}
                  disabled={unavailable}
                  onClick={() => onSelectService(s)}
                  className={`rounded border p-2.5 text-left text-sm ${
                    selected
                      ? 'border-copper-500 bg-copper-600/15'
                      : unavailable
                        ? 'cursor-not-allowed border-cream/10 text-cream/40'
                        : 'border-cream/15 bg-pine-950 hover:border-copper-500/60'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`font-medium ${unavailable ? 'line-through' : ''}`}>{s.name}</span>
                    <span className={unavailable ? '' : 'text-copper-200'}>{s.priceRange ?? ''}</span>
                  </span>
                  <span className="text-xs text-cream/50">
                    {unavailable ? '· unavailable for this barber' : `· ${s.durationMinutes} min`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
