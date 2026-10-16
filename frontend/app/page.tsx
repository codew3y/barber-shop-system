import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CalendarClock, RefreshCw, Scissors } from 'lucide-react';
import { getShopPageData } from '@barberhouse/backend/lib/shop-page-data';
import { Reveal } from '@/components/ui/Reveal';
import { Faq } from '@/components/faq';
import { ServiceMenu, type MenuService } from '@/components/public/ServiceMenu';

// Services/staff change rarely — serve statically, refresh in background.
export const revalidate = 60;

/**
 * Photography. All four are Unsplash, whose licence permits commercial use
 * with no attribution required; the source ids are kept here so a photo can
 * be traced or replaced later. Each was reviewed at full size before use —
 * real documentary work, not synthetic stock: legible brand text on the
 * tools, irregular mortar and worn tile in the interiors, correct anatomy
 * and hair clippings on the cape in the trim shot.
 *
 * Replace these with photographs of the actual shop when there are some.
 * That is the only real fix for stock imagery, and the alt text below is
 * written so it still reads correctly once they are swapped.
 */
const photos = {
  interior: { src: '/photos/shop-interior.jpg', id: 'photo-1585747860715' },
  trim: { src: '/photos/beard-trim.jpg', id: 'photo-1503951914875' },
  chairs: { src: '/photos/chairs-row.jpg', id: 'photo-1536520002442' },
} as const;

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
  const data = await getShopPageData();
  if (!data) {
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

  const { shop, services, staff } = data;

  // Flatten to plain numbers before handing this to a client component:
  // Prisma Decimal instances are not serialisable across that boundary.
  const menu: MenuService[] = services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    category: s.category,
    price: Number(s.price),
    barbers: s.staff.map((ss) => ({
      id: ss.staff.id,
      name: `${ss.staff.user.firstName} ${ss.staff.user.lastName}`,
      price: Number(ss.customPrice ?? s.price),
    })),
  }));

  const stats: [string, string][] = [
    [String(staff.length).padStart(2, '0'), 'Barbers on the floor'],
    [String(services.length).padStart(2, '0'), 'Services on the menu'],
    ['20%', 'Downpayment to hold'],
  ];

  return (
    <div>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="bleed relative isolate -mt-8 min-h-[86vh] overflow-hidden sm:min-h-[88vh]">
        <Image
          src={photos.interior.src}
          alt=""
          fill
          priority
          sizes="(max-width: 1200px) 100vw, 1200px"
          className="photo object-cover"
        />
        <div aria-hidden className="scrim-hero absolute inset-0" />

        {/* Content hangs off the bottom: the photograph gets the top two
            thirds, the type sits where the scrim is darkest. */}
        <div className="relative mx-auto flex min-h-[86vh] w-full max-w-6xl flex-col justify-end px-5 pb-14 pt-28 sm:min-h-[88vh] sm:pb-20">
          <p className="eyebrow rise rise-1">
            <span className="h-px w-6 bg-brass-500/60" />
            {shop.city} · Est. for sharp looks
          </p>

          <h1 className="font-display rise rise-2 mt-5 max-w-3xl text-5xl leading-[0.95] sm:text-7xl">
            Sharp looks.
            <br />
            <span className="foil italic">Zero waiting room.</span>
          </h1>

          <p className="rise rise-3 mt-5 max-w-md text-base leading-relaxed text-ivory/80 sm:text-lg">
            {shop.description ?? 'Choose your barber and chair time, and walk in like a regular.'}
          </p>

          <div className="rise rise-3 mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/booking/${shop.id}`}
              className="btn-primary px-7 py-3 text-base"
              data-press
            >
              Book your chair
              <ArrowRight size={17} />
            </Link>
            <a href="#services" className="btn-ghost px-7 py-3 text-base" data-press>
              View the menu
            </a>
          </div>

          <dl
            className="rise rise-4 mt-12 grid max-w-xl grid-cols-3 gap-4 border-t pt-6"
            style={{ borderColor: 'var(--line)' }}
          >
            {stats.map(([value, label]) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className="font-display text-3xl text-brass-300" data-numeric>
                  {value}
                </dt>
                <dd className="text-[0.625rem] uppercase leading-snug tracking-[0.14em] text-ivory-dim/75 sm:text-[0.6875rem] sm:tracking-[0.16em]">
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
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl text-brass-300"
                style={{
                  background: 'rgb(196 160 72 / 0.12)',
                  boxShadow: 'inset 0 0 0 1px rgb(196 160 72 / 0.25)',
                }}
              >
                <f.Icon size={19} strokeWidth={1.75} />
              </span>
              <h2 className="font-display mt-4 text-xl">{f.title}</h2>
              <p className="muted mt-2 text-sm leading-relaxed">{f.text}</p>
            </div>
          </Reveal>
        ))}
      </section>

      {/* --------------------------------------------------------- Craft band */}
      <Reveal className="mt-6 block">
        <section className="band relative isolate overflow-hidden">
          <div className="relative h-[20rem] sm:h-[24rem]">
            <Image
              src={photos.trim.src}
              alt="A barber trimming a client's beard with shears"
              fill
              sizes="(max-width: 1200px) 100vw, 1200px"
              /* object-position pulls the crop up: the face and shears sit in
                 the upper third, and a centred crop cut them out entirely. */
              className="photo-dark object-cover object-[center_28%]"
            />
            <div aria-hidden className="scrim-band absolute inset-0" />
            <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-12">
              <p className="eyebrow">Unhurried</p>
              <p className="font-display mt-3 max-w-md text-3xl leading-tight sm:text-4xl">
                One chair, one client, no rushing the finish.
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ------------------------------------------------------------ Services */}
      <section id="services" className="mt-24 scroll-mt-24">
        <Reveal>
          <p className="eyebrow">The menu</p>
          <h2 className="font-display mt-3 text-4xl sm:text-5xl">Cuts &amp; services</h2>
          <p className="muted mt-3 max-w-lg">
            Fixed prices per barber, published up front. Open any line to see the work and what each
            barber charges.
          </p>
        </Reveal>

        <ServiceMenu services={menu} shopId={shop.id} />
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

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
          <Reveal className="hidden lg:block">
            <div className="photo-zoom relative h-full min-h-[22rem] overflow-hidden rounded-2xl">
              <Image
                src={photos.chairs.src}
                alt="A row of brass-trimmed barber chairs down the length of the shop"
                fill
                sizes="17rem"
                className="photo object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }}
              />
            </div>
          </Reveal>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {staff.map((s, i) => (
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
                    <ArrowRight size={15} className="nudge-x" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------- Closing CTA */}
      <Reveal className="mt-24 block">
        <section className="bleed relative isolate overflow-hidden px-6 py-24 text-center sm:px-12">
          {/* Same room as the hero, held well back — it bookends the page
              without competing with the headline at the top. */}
          <Image
            src={photos.interior.src}
            alt=""
            fill
            sizes="(max-width: 1200px) 100vw, 1200px"
            className="object-cover opacity-30"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--color-ink-950) 80%, transparent), color-mix(in srgb, var(--color-ink-950) 92%, transparent))',
            }}
          />
          <div className="relative mx-auto w-full max-w-6xl">
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
          </div>
        </section>
      </Reveal>

      {/* ---------------------------------------------------------- House rules */}
      <section className="mt-24">
        <Reveal>
          <p className="eyebrow">House rules</p>
          <h2 className="font-display mt-3 text-4xl sm:text-5xl">Fair chairs for all</h2>
        </Reveal>
        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: '20% down',
              text: 'A small downpayment holds your chair. It comes off your total at the shop.',
            },
            {
              title: 'Free moves',
              text: 'Reschedule or cancel from your dashboard — no calls, no awkwardness.',
            },
            {
              title: '15-minute grace',
              text: 'Running late? Your chair holds 15 minutes past start before release.',
            },
          ].map((r, i) => (
            <Reveal as="li" key={r.title} delay={i * 70} className="h-full">
              <div className="card lift-hover h-full border-l-2">
                <p className="font-medium">{r.title}</p>
                <p className="muted mt-2 text-sm leading-relaxed">{r.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      <Faq />
    </div>
  );
}
