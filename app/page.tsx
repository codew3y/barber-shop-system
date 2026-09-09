import Link from 'next/link';
import { ArrowRight, CalendarClock, RefreshCw, Scissors } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Reveal } from '@/components/ui/Reveal';
import { depositFor, peso, priceRange } from '@/lib/format';

const features = [
  {
    Icon: Scissors,
    title: 'Master Barbers',
    text: 'Chair-tested craftsmen who treat every fade, taper, and shave like a signature piece.',
  },
  {
    Icon: CalendarClock,
    title: 'Honest Scheduling',
    text: 'Live chair availability with sensible buffers — the slot you pick is the slot you get.',
  },
  {
    Icon: RefreshCw,
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
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="font-display text-2xl">The house isn&apos;t open yet</h1>
        <p className="muted mt-2 text-sm">
          No shop on the books. Run <code className="text-brass-300">npm run db:seed</code> to open
          BarberHouse locally.
        </p>
      </div>
    );
  }

  const stats: [string, string][] = [
    [String(shop.staff.length).padStart(2, '0'), 'Barbers on the floor'],
    [String(shop.services.length).padStart(2, '0'), 'Services on the menu'],
    ['20%', 'Downpayment to hold'],
  ];

  return (
    <div>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="band relative overflow-hidden px-6 py-20 text-center sm:px-12 sm:py-28">
        {/* Faint vertical rules — a barbershop mirror wall, not a gradient blob. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent 0 7.5rem, color-mix(in srgb, var(--color-ivory) 5%, transparent) 7.5rem 7.5625rem)',
            maskImage: 'radial-gradient(70% 60% at 50% 40%, black, transparent)',
          }}
        />

        <div className="relative">
          <p className="eyebrow rise rise-1">
            <span className="h-px w-6 bg-brass-500/60" />
            {shop.city} · Est. for sharp looks
            <span className="h-px w-6 bg-brass-500/60" />
          </p>

          <h1 className="font-display rise rise-2 mx-auto mt-6 max-w-4xl text-5xl leading-[0.98] sm:text-7xl">
            Sharp looks.
            <br />
            <span className="foil italic">Zero waiting room.</span>
          </h1>

          <p className="rise rise-3 muted mx-auto mt-6 max-w-lg text-base leading-relaxed sm:text-lg">
            {shop.description ?? 'Choose your barber and chair time, and walk in like a regular.'}
          </p>

          <div className="rise rise-3 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={`/booking/${shop.id}`} className="btn-primary px-7 py-3 text-base" data-press>
              Book your chair
              <ArrowRight size={17} />
            </Link>
            <a href="#services" className="btn-ghost px-7 py-3 text-base" data-press>
              View the menu
            </a>
          </div>

          <dl className="rise rise-4 mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-4">
            {stats.map(([value, label]) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <dt className="font-display text-3xl text-brass-300" data-numeric>
                  {value}
                </dt>
                <dd className="text-[0.6875rem] uppercase tracking-[0.16em] text-ivory-dim/75">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------------ Features */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 70}>
            <div className="card lift-hover h-full">
              <div className="flex items-start justify-between">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-brass-300"
                  style={{
                    background: 'rgb(196 160 72 / 0.12)',
                    boxShadow: 'inset 0 0 0 1px rgb(196 160 72 / 0.25)',
                  }}
                >
                  <f.Icon size={19} strokeWidth={1.75} />
                </span>
                <span className="font-display text-2xl text-ivory/12" data-numeric>
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <h2 className="font-display mt-4 text-xl">{f.title}</h2>
              <p className="muted mt-2 text-sm leading-relaxed">{f.text}</p>
            </div>
          </Reveal>
        ))}
      </section>

      {/* ------------------------------------------------------------ Services */}
      <section id="services" className="mt-24 scroll-mt-24">
        <Reveal>
          <p className="eyebrow">The menu</p>
          <h2 className="font-display mt-3 text-4xl sm:text-5xl">Cuts &amp; services</h2>
          <p className="muted mt-3 max-w-lg">
            Fixed prices per barber, published up front. What you see here is what you pay at the
            chair.
          </p>
        </Reveal>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {shop.services.map((s, i) => (
            <Reveal as="li" key={s.id} delay={(i % 2) * 70} className="h-full">
              <div className="card lift-hover flex h-full flex-col">
                {/* Classic menu leader: name — dotted rule — price */}
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-2xl">{s.name}</span>
                  <span className="mb-1 h-px flex-1 border-b border-dotted border-ivory/20" />
                  <span className="font-display shrink-0 text-lg text-brass-300" data-numeric>
                    {priceRange(
                      Number(s.price),
                      s.staff.map((x) => (x.customPrice ? Number(x.customPrice) : null))
                    )}
                  </span>
                </div>

                {s.description && (
                  <p className="muted mt-2 line-clamp-1 text-sm">{s.description}</p>
                )}
                <p className="mt-2 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-ivory-dim/70">
                  <span data-numeric>{s.durationMinutes} min</span>
                  {s.category && (
                    <>
                      <span className="h-1 w-1 rounded-full bg-brass-500/60" />
                      <span>{s.category}</span>
                    </>
                  )}
                </p>

                {s.staff.length > 0 && (
                  <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
                    <p className="eyebrow mb-3">Pricing per barber</p>
                    <ul className="grid gap-2.5">
                      {s.staff.map((ss) => {
                        const price = ss.customPrice ?? s.price;
                        return (
                          <li key={ss.staff.id} className="flex items-start justify-between gap-3 text-sm">
                            <span className="text-ivory-dim">
                              {ss.staff.user.firstName} {ss.staff.user.lastName}
                            </span>
                            <span className="text-right">
                              <span className="font-medium" data-numeric>
                                {peso(price)}
                              </span>
                              <span className="block text-xs text-ivory-dim/70" data-numeric>
                                {peso(depositFor(Number(price)))} downpayment
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------- Barbers */}
      <section id="barbers" className="mt-24 scroll-mt-24">
        <Reveal>
          <p className="eyebrow">The chairs</p>
          <h2 className="font-display mt-3 text-4xl sm:text-5xl">Meet the barbers</h2>
          <p className="muted mt-3 max-w-xl">
            Three chairs, one standard: every barber here cuts full-time, takes their time, and
            guarantees the work.
          </p>
        </Reveal>

        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {shop.staff.map((s, i) => (
            <Reveal as="li" key={s.id} delay={i * 70} className="h-full">
              <div className="card lift-hover flex h-full flex-col">
                <span
                  className="font-display flex h-16 w-16 items-center justify-center rounded-full text-2xl text-brass-300"
                  style={{
                    background:
                      'linear-gradient(180deg, rgb(196 160 72 / 0.2), rgb(196 160 72 / 0.05))',
                    boxShadow: 'inset 0 0 0 1px rgb(196 160 72 / 0.3)',
                  }}
                  aria-hidden
                >
                  {s.user.firstName.charAt(0)}
                </span>
                <p className="font-display mt-4 text-xl">
                  {s.user.firstName} {s.user.lastName}
                </p>
                <p className="eyebrow mt-1.5">{s.title ?? 'Hairstylist & Barber'}</p>
                {s.bio && <p className="muted mt-3 text-sm leading-relaxed">{s.bio}</p>}
                <Link
                  href={`/booking/${shop.id}?staff=${s.id}`}
                  className="group mt-5 inline-flex items-center gap-1.5 self-start text-sm font-medium text-brass-300 transition-colors duration-200 hover:text-brass-200"
                >
                  Book with {s.user.firstName}
                  <ArrowRight
                    size={15}
                    className="nudge-x"
                  />
                </Link>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------------- Closing CTA */}
      <Reveal className="mt-24 block">
        <section className="band relative overflow-hidden px-6 py-16 text-center sm:px-12">
          <p className="eyebrow">Ready when you are</p>
          <h2 className="font-display mx-auto mt-4 max-w-2xl text-4xl leading-tight sm:text-5xl">
            Pick a chair. <span className="foil italic">Keep the day moving.</span>
          </h2>
          <Link
            href={`/booking/${shop.id}`}
            className="btn-primary mt-8 px-7 py-3 text-base"
            data-press
          >
            Book your chair
            <ArrowRight size={17} />
          </Link>
        </section>
      </Reveal>
    </div>
  );
}
