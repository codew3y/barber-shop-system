import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, MapPin, Phone } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { priceRange } from '@/lib/format';

export default async function ShopPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const shop = await prisma.shop.findFirst({
    where: { id: shopId, deletedAt: null, isActive: true },
    include: {
      services: {
        where: { isActive: true, deletedAt: null },
        orderBy: { price: 'asc' },
        include: { staff: { select: { customPrice: true } } },
      },
      staff: {
        where: { isActive: true, deletedAt: null },
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!shop) notFound();

  return (
    <div>
      <section className="band relative overflow-hidden px-6 py-14 sm:px-12 sm:py-16">
        <p className="eyebrow rise rise-1">The shop</p>
        <h1 className="font-display rise rise-2 mt-4 max-w-2xl text-5xl sm:text-6xl">{shop.name}</h1>

        <div className="rise rise-3 muted mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-2">
            <MapPin size={14} className="text-brass-400" />
            {shop.addressLine1}, {shop.city}, {shop.state}
          </span>
          <span className="flex items-center gap-2">
            <Phone size={14} className="text-brass-400" />
            <span data-numeric>{shop.phone}</span>
          </span>
        </div>

        {shop.description && (
          <p className="rise rise-3 mt-6 max-w-xl leading-relaxed text-ivory/85">
            {shop.description}
          </p>
        )}

        <Link href={`/booking/${shop.id}`} className="btn-primary rise rise-4 mt-9 px-7 py-3 text-base" data-press>
          Book a chair
          <ArrowRight size={17} />
        </Link>
      </section>

      <div className="mt-10 grid gap-10 sm:grid-cols-2">
        <div>
          <p className="eyebrow">The menu</p>
          <h2 className="font-display mt-3 mb-5 text-3xl">Services</h2>
          <ul className="grid gap-2.5">
            {shop.services.map((s) => (
              <li key={s.id} className="card lift-hover py-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-medium">{s.name}</span>
                  <span className="mb-1 h-px flex-1 border-b border-dotted border-ivory/20" />
                  <span className="shrink-0 text-sm text-brass-300" data-numeric>
                    {priceRange(
                      Number(s.price),
                      s.staff.map((x) => (x.customPrice ? Number(x.customPrice) : null))
                    )}
                  </span>
                </div>
                <p className="mt-1.5 text-xs uppercase tracking-[0.14em] text-ivory-dim/70">
                  <span data-numeric>{s.durationMinutes} min</span>
                  {s.category ? ` · ${s.category}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow">The chairs</p>
          <h2 className="font-display mt-3 mb-5 text-3xl">Barbers</h2>
          <ul className="grid gap-2.5">
            {shop.staff.map((s) => (
              <li key={s.id} className="card lift-hover flex items-center gap-3.5 py-4">
                <span
                  className="font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brass-300"
                  style={{
                    background: 'rgb(196 160 72 / 0.13)',
                    boxShadow: 'inset 0 0 0 1px rgb(196 160 72 / 0.26)',
                  }}
                  aria-hidden
                >
                  {s.user.firstName.charAt(0)}
                </span>
                <span>
                  <span className="block font-medium">
                    {s.user.firstName} {s.user.lastName}
                  </span>
                  <span className="block text-xs uppercase tracking-[0.14em] text-ivory-dim/70">
                    {s.title ?? 'Hairstylist & Barber'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
