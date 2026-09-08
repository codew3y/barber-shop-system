import Link from 'next/link';
import { ShopBrowser } from '@/components/public/ShopBrowser';

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

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-pine-950 px-6 py-14 text-center text-cream sm:px-12 sm:py-20">
        <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-copper-500/40 bg-copper-600/10 px-4 py-1 text-xs font-semibold tracking-widest text-copper-200">
          ★ THE NEIGHBORHOOD BOOKING HOUSE
        </p>
        <h1 className="font-display mx-auto max-w-3xl text-4xl leading-tight sm:text-6xl">
          Sharp Looks.
          <br />
          <span className="text-copper-500">Zero Waiting Room.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-cream/70">
          Browse local shops, choose your barber and chair time, and walk in like a regular —
          no account needed to look around.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="#catalog"
            className="rounded-full bg-copper-600 px-7 py-3 font-medium text-cream hover:bg-copper-700"
          >
            Find your chair
          </Link>
          <Link
            href="/register"
            className="rounded-full border border-cream/25 px-7 py-3 hover:bg-cream/10"
          >
            Create account
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border border-espresso/10 bg-white/60 p-5">
            <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-copper-100 text-lg text-copper-700">
              {f.icon}
            </span>
            <h2 className="font-display text-lg">{f.title}</h2>
            <p className="mt-1 text-sm text-bark">{f.text}</p>
          </div>
        ))}
      </section>

      {/* Catalog */}
      <section id="catalog" className="mt-12 scroll-mt-20">
        <p className="text-xs font-semibold tracking-widest text-copper-700">SHOP CATALOG</p>
        <h2 className="font-display mb-5 text-3xl">Chairs near you</h2>
        <ShopBrowser />
      </section>
    </div>
  );
}
