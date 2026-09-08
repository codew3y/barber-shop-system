import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { peso } from '@/lib/format';

const features = [
  {
    icon: '✂',
    title: 'Master Barbers',
    text: 'Chair-tested craftsmen who treat every fade, taper, and shave like a signature piece.',
  },
  {
    icon: '◷',
    title: 'Honest Scheduling',
    text: 'Live chair availability with sensible buffers — the slot you pick is the slot you get.',
  },
  {
    icon: '↺',
    title: 'Easy Changes',
    text: 'Plans shift. Reschedule or cancel from your dashboard in seconds, no phone tag.',
  },
];

export default async function Home() {
  const shop = await prisma.shop.findFirst({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      services: {
        where: { isActive: true, deletedAt: null },
        orderBy: { price: 'asc' },
        include: {
          staff: {
            select: {
              customPrice: true,
              staff: {
                select: {
                  id: true,
                  user: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      },
      staff: {
        where: { isActive: true, deletedAt: null },
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  if (!shop) {
    return (
      <div className="card">
        <h1 className="font-display text-2xl">The house isn&apos;t open yet</h1>
        <p className="mt-1 text-sm text-cream/60">
          No shop on the books. Run <code>npm run db:seed</code> to open BarberHouse locally.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <section className="band overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-20">
        <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded border border-copper-500/40 bg-copper-600/10 px-4 py-1 text-xs font-semibold tracking-widest text-copper-200">
          ★ {shop.city.toUpperCase()} · EST. FOR SHARP LOOKS
        </p>
        <h1 className="font-display mx-auto max-w-3xl text-4xl uppercase leading-tight sm:text-6xl">
          Sharp Looks.
          <br />
          <span className="text-copper-500">Zero Waiting Room.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-cream/70">
          {shop.description ?? 'Choose your barber and chair time, and walk in like a regular.'}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={`/booking/${shop.id}`}
            className="rounded bg-copper-600 px-7 py-3 font-medium text-cream hover:bg-copper-700"
          >
            Book your chair
          </Link>
          <Link
            href="#services"
            className="rounded border border-cream/25 px-7 py-3 hover:bg-cream/10"
          >
            View the menu
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border border-cream/10 bg-pine-900 p-5">
            <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-copper-600/15 text-lg text-copper-200">
              {f.icon}
            </span>
            <h2 className="font-display text-lg">{f.title}</h2>
            <p className="mt-1 text-sm text-cream/60">{f.text}</p>
          </div>
        ))}
      </section>

      {/* Services */}
      <section id="services" className="mt-12 scroll-mt-20">
        <p className="text-xs font-semibold tracking-widest text-copper-200">THE MENU</p>
        <h2 className="font-display mb-5 text-3xl">Cuts & services</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {shop.services.map((s) => (
            <li key={s.id} className="rounded-2xl border border-cream/10 bg-pine-900 p-5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-xl">{s.name}</span>
                <span className="text-copper-200">{peso(s.price)}</span>
              </div>
              {s.description && (
                <p className="mt-1 line-clamp-1 text-sm text-cream/60">{s.description}</p>
              )}
              <p className="mt-1 text-xs text-cream/50">
                {s.durationMinutes} min{s.category ? ` · ${s.category}` : ''}
              </p>
              {s.staff.length > 0 && (
                <div className="mt-3 border-t border-cream/10 pt-3">
                  <p className="mb-1 text-xs font-semibold tracking-widest text-copper-200">
                    PRICING PER BARBER
                  </p>
                  <ul className="grid gap-1">
                  {s.staff.map((ss) => (
                    <li key={ss.staff.id} className="flex justify-between text-sm">
                      <span className="text-cream/70">
                        {ss.staff.user.firstName} {ss.staff.user.lastName}
                      </span>
                      <span className="font-medium">
                        {peso(ss.customPrice ?? s.price)}
                      </span>
                    </li>
                  ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Barbers */}
      <section id="barbers" className="mt-12 scroll-mt-20">
        <p className="text-xs font-semibold tracking-widest text-copper-200">THE CHAIRS</p>
        <h2 className="font-display mb-2 text-3xl">Meet the barbers</h2>
        <p className="mb-5 max-w-xl text-cream/60">
          Three chairs, one standard: every barber here cuts full-time, takes their time, and
          guarantees the work.
        </p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {shop.staff.map((s) => (
            <li key={s.id} className="rounded-2xl border border-cream/10 bg-pine-900 p-5">
              <span className="font-display mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-copper-600/15 text-2xl text-copper-200">
                {s.user.firstName.charAt(0)}
              </span>
              <p className="font-medium">
                {s.user.firstName} {s.user.lastName}
              </p>
              <p className="mt-0.5 text-xs font-semibold tracking-widest text-copper-200">
                {(s.title ?? 'Hairstylist & Barber').toUpperCase()}
              </p>
              {s.bio && <p className="mt-2 text-sm text-cream/60">{s.bio}</p>}
              <div className="mt-3 text-right">
                <Link
                  href={`/booking/${shop.id}?staff=${s.id}`}
                  className="text-sm font-medium text-copper-200 hover:underline"
                >
                  Book with {s.user.firstName} →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
}
