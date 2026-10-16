'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { depositFor, peso, priceRange } from '@barberhouse/backend/lib/format';

export interface MenuService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  category: string | null;
  price: number;
  /** Per-barber prices, already flattened so this stays serialisable. */
  barbers: { id: string; name: string; price: number }[];
}

/**
 * Pick a photograph for a service from its name and category.
 *
 * Keyed on keywords rather than service id so a shop can rename or add
 * services without the menu losing its imagery — an unmatched service falls
 * back to the shave shot rather than rendering a hole.
 */
function photoFor(service: MenuService): { src: string; alt: string } {
  const haystack = `${service.name} ${service.category ?? ''}`.toLowerCase();
  if (/(fade|taper|skin|clipper|buzz)/.test(haystack)) {
    return {
      src: '/photos/service-fade.jpg',
      alt: 'A barber tapering the nape with clippers',
    };
  }
  if (/(shave|beard|towel|razor)/.test(haystack)) {
    return {
      src: '/photos/service-shave.jpg',
      alt: 'A hot-towel straight-razor shave in progress, steam rising',
    };
  }
  return {
    src: '/photos/service-cut.jpg',
    alt: 'A barber cutting with scissors over comb',
  };
}

function ServiceRow({
  service,
  shopId,
  open,
  onToggle,
}: {
  service: MenuService;
  shopId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const photo = photoFor(service);
  const range = priceRange(
    service.price,
    service.barbers.map((b) => b.price)
  );

  return (
    <li style={{ borderBottom: '1px solid var(--line)' }}>
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="group flex w-full items-baseline gap-4 py-6 text-left"
        >
          <ChevronDown
            size={18}
            aria-hidden
            className={`shrink-0 self-center text-brass-400 transition-transform duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] ${
              open ? 'rotate-180' : ''
            }`}
          />
          <span
            className={`font-display text-2xl transition-colors duration-200 sm:text-3xl ${
              open ? 'text-brass-200' : 'text-ivory'
            }`}
          >
            {service.name}
          </span>
          <span className="mb-1.5 hidden h-px flex-1 border-b border-dotted border-ivory/20 sm:block" />
          <span className="ml-auto shrink-0 text-right sm:ml-0">
            <span className="font-display block text-lg text-brass-300" data-numeric>
              {range}
            </span>
            <span
              className="block text-[0.6875rem] uppercase tracking-[0.14em] text-ivory-dim/70"
              data-numeric
            >
              {service.durationMinutes} min
            </span>
          </span>
        </button>
      </h3>

      {/* 0fr -> 1fr is the one accordion trick that animates height without
          measuring it in JS. The inner element needs min-height:0 or the
          content refuses to collapse. */}
      <div
        id={panelId}
        role="region"
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-6 pb-8 sm:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <div className="relative h-52 overflow-hidden rounded-2xl sm:h-full sm:min-h-[13rem]">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(max-width: 640px) 100vw, 20rem"
                className="photo object-cover"
              />
            </div>

            <div>
              {service.description && <p className="text-ivory-dim">{service.description}</p>}

              <p className="eyebrow mt-5 mb-3">Pricing per barber</p>
              <ul className="grid gap-2.5">
                {service.barbers.map((b) => (
                  <li key={b.id} className="flex items-baseline gap-3 text-sm">
                    <span className="text-ivory-dim">{b.name}</span>
                    <span className="mb-1 h-px flex-1 border-b border-dotted border-ivory/15" />
                    <span className="shrink-0 text-right">
                      <span className="font-medium" data-numeric>
                        {peso(b.price)}
                      </span>
                      <span className="block text-xs text-ivory-dim/70" data-numeric>
                        {peso(depositFor(b.price))} downpayment
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={`/booking/${shopId}`}
                className="group mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brass-300 transition-colors duration-200 hover:text-brass-200"
              >
                Book {service.name}
                <ArrowRight size={15} className="nudge-x" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

export function ServiceMenu({ services, shopId }: { services: MenuService[]; shopId: string }) {
  // One open at a time: the panels carry photographs, and several open at
  // once turns the menu into a scroll marathon.
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="mt-8" style={{ borderTop: '1px solid var(--line)' }}>
      {services.map((s) => (
        <ServiceRow
          key={s.id}
          service={s}
          shopId={shopId}
          open={openId === s.id}
          onToggle={() => setOpenId((cur) => (cur === s.id ? null : s.id))}
        />
      ))}
    </ul>
  );
}
