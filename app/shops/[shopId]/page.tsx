import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export default async function ShopPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const shop = await prisma.shop.findFirst({
    where: { id: shopId, deletedAt: null, isActive: true },
    include: {
      services: { where: { isActive: true, deletedAt: null }, orderBy: { price: 'asc' } },
      staff: {
        where: { isActive: true, deletedAt: null },
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!shop) notFound();

  return (
    <div>
      <section className="rounded-3xl bg-pine-900 px-6 py-10 text-cream sm:px-10">
        <p className="text-xs font-semibold tracking-widest text-copper-200">THE SHOP</p>
        <h1 className="font-display mt-1 text-4xl">{shop.name}</h1>
        <p className="mt-2 text-cream/70">
          {shop.addressLine1}, {shop.city}, {shop.state} · {shop.phone}
        </p>
        {shop.description && <p className="mt-3 max-w-xl text-cream/80">{shop.description}</p>}
        <Link
          href={`/booking/${shop.id}`}
          className="mt-6 inline-block rounded-full bg-copper-600 px-6 py-2.5 font-medium text-cream hover:bg-copper-700"
        >
          Book a chair
        </Link>
      </section>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="font-display mb-3 text-2xl">Services</h2>
          <ul className="grid gap-2">
            {shop.services.map((s) => (
              <li key={s.id} className="rounded-xl border border-espresso/10 bg-white/70 px-4 py-3">
                <div className="flex justify-between font-medium">
                  <span>{s.name}</span>
                  <span className="text-pine-800">${Number(s.price).toFixed(2)}</span>
                </div>
                <p className="text-sm text-bark">
                  {s.durationMinutes} min{s.category ? ` · ${s.category}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-display mb-3 text-2xl">Barbers</h2>
          <ul className="grid gap-2">
            {shop.staff.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-xl border border-espresso/10 bg-white/70 px-4 py-3">
                <span className="font-display flex h-10 w-10 items-center justify-center rounded-full bg-copper-100 text-copper-700">
                  {s.user.firstName.charAt(0)}
                </span>
                <span className="font-medium">
                  {s.user.firstName} {s.user.lastName}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
