'use client';

import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { apiJson } from '@/lib/api-client';
import { depositFor, peso } from '@/lib/format';
import type { Service, StaffMember } from '@/lib/types';

function offeredIds(staff: StaffMember | null | undefined): string[] {
  return (staff?.services ?? []).map((x) => x.service.id);
}

function ColumnHeading({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h3 className="font-display text-xl">{label}</h3>
      <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-ivory-dim/65">{hint}</span>
    </div>
  );
}

function PickSkeleton() {
  return (
    <div className="card">
      <div className="grid gap-8 sm:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col}>
            <div className="skeleton mb-4 h-6 w-28" />
            <div className="grid gap-2.5">
              {[0, 1, 2].map((row) => (
                <div key={row} className="skeleton h-14 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading chairs…</span>
    </div>
  );
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
    staleTime: 60_000,
  });
  const staffQ = useQuery({
    queryKey: ['staff', shopId],
    queryFn: () => apiJson<{ staff: StaffMember[] }>(`/api/v1/shops/${shopId}/staff`),
    staleTime: 60_000,
  });

  if (servicesQ.isLoading || staffQ.isLoading) return <PickSkeleton />;

  const services = servicesQ.data?.services ?? [];
  const barbers = staffQ.data?.staff ?? [];
  const staffServiceIds = offeredIds(staff);

  return (
    <div className="card">
      <div className="grid gap-8 sm:grid-cols-2">
        {/* Left: barbers */}
        <div>
          <ColumnHeading label="Barber" hint={`${barbers.length} chairs`} />
          <div className="grid gap-2.5">
            {barbers.map((b) => {
              const unavailable = !!service && !offeredIds(b).includes(service.id);
              const selected = staff?.id === b.id;
              return (
                <button
                  key={b.id}
                  disabled={unavailable}
                  aria-pressed={selected}
                  onClick={() => onSelectStaff(b)}
                  className={`pickable flex items-center gap-3 ${
                    selected ? 'pickable-selected' : unavailable ? 'pickable-disabled' : ''
                  }`}
                >
                  <span
                    className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base text-brass-300"
                    style={{
                      background: 'rgb(196 160 72 / 0.13)',
                      boxShadow: 'inset 0 0 0 1px rgb(196 160 72 / 0.26)',
                    }}
                    aria-hidden
                  >
                    {b.user.firstName.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-medium ${unavailable ? 'line-through' : ''}`}
                    >
                      {b.user.firstName} {b.user.lastName}
                    </span>
                    <span className="block truncate text-xs text-ivory-dim/75">
                      {unavailable ? 'Unavailable for this service' : (b.title ?? 'Hairstylist & Barber')}
                    </span>
                  </span>
                  {selected && <Check size={16} className="shrink-0 text-brass-300" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: services */}
        <div>
          <ColumnHeading label="Service" hint={`${services.length} on the menu`} />
          <div className="grid gap-2.5">
            {services.map((s) => {
              const unavailable = !!staff && !staffServiceIds.includes(s.id);
              const selected = service?.id === s.id;
              const mine = staff
                ? ((staff.services ?? []).find((x) => x.service.id === s.id)?.customPrice ?? s.price)
                : s.price;
              const downBase = staff ? mine : (s.minPrice ?? s.price);
              return (
                <button
                  key={s.id}
                  disabled={unavailable}
                  aria-pressed={selected}
                  onClick={() => onSelectService(s)}
                  className={`pickable ${
                    selected ? 'pickable-selected' : unavailable ? 'pickable-disabled' : ''
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={`text-sm font-medium ${unavailable ? 'line-through' : ''}`}>
                      {s.name}
                    </span>
                    <span
                      className={`shrink-0 text-sm ${unavailable ? 'text-ivory-dim/60' : 'text-brass-300'}`}
                      data-numeric
                    >
                      {staff ? peso(mine) : (s.priceRange ?? '')}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-ivory-dim/75" data-numeric>
                    {unavailable
                      ? 'Unavailable for this barber'
                      : `${s.durationMinutes} min · ${peso(depositFor(Number(downBase)))} downpayment`}
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
