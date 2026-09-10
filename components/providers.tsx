'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { CalendarCheck, Clock3, LogIn, MapPin, Phone } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiJson } from '@/lib/api-client';
import type { Shop } from '@/lib/types';

function BrandMark() {
  return (
    <Link href="/" className="group flex items-center gap-2.5" data-press>
      <span className="relative block h-9 w-9 overflow-hidden rounded-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/barberlogo-icon.jpg" alt="BarberHouse" className="h-full w-full object-cover" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.0625rem] tracking-[0.02em]">BarberHouse</span>
        <span className="mt-0.5 text-[0.5625rem] font-semibold uppercase tracking-[0.28em] text-ivory-dim/70">
          Est. Grooming
        </span>
      </span>
    </Link>
  );
}

function Nav() {
  const { user, ready, clear, hydrate } = useAuthStore();
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState('');
  const { data: shopData } = useQuery({
    queryKey: ['nav-shop'],
    queryFn: () => apiJson<{ shops: { id: string }[] }>('/api/v1/shops?limit=1'),
    staleTime: 5 * 60_000,
  });
  const bookHref = shopData?.shops[0] ? `/booking/${shopData.shops[0].id}` : '/';
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // The header stays transparent over the hero and only earns its hairline
  // and blur once content is passing underneath it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll-spy: highlight follows the section in view (works for clicks and scrolling).
  // Derived per-pathname so no state sync is needed when leaving home.
  useEffect(() => {
    if (pathname !== '/') return;
    const ids = ['services', 'barbers'];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    elements.forEach((el) => observer.observe(el));
    // Back at the very top (hero), no section is active — clear the stale highlight.
    const onScroll = () => {
      if (window.scrollY < 120) setActiveSection('');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [pathname]);

  const linkActive = (id: string) => pathname === '/' && activeSection === id;

  // Brass underline grows from the centre on hover/active — transform only,
  // so it composites instead of triggering layout.
  const sectionLink = (active: boolean) =>
    `relative hidden py-1 text-sm font-medium transition-colors duration-200 sm:inline-block ${
      active ? 'text-brass-300' : 'text-ivory-dim hover:text-ivory'
    } after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:bg-brass-400
     after:transition-transform after:duration-200 after:ease-[cubic-bezier(0.23,1,0.32,1)]
     ${active ? 'after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100'}`;

  const utilityLink = 'text-sm text-ivory-dim transition-colors duration-200 hover:text-ivory';

  return (
    <header
      data-scrolled={scrolled || undefined}
      className="site-header sticky top-0 z-30"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <BrandMark />
        <nav className="flex items-center gap-3 sm:gap-6">
          <Link href="/#services" className={sectionLink(linkActive('services'))}>
            Services
          </Link>
          <Link href="/#barbers" className={sectionLink(linkActive('barbers'))}>
            Barbers
          </Link>
          {ready && user ? (
            <>
              <Link href="/dashboard" className={utilityLink}>
                My bookings
              </Link>
              {(user.role === 'staff' || user.role === 'admin' || user.role === 'super_admin') && (
                <Link href="/staff" className={utilityLink}>
                  Staff
                </Link>
              )}
              {(user.role === 'admin' || user.role === 'super_admin') && (
                <Link href="/admin" className={utilityLink}>
                  Admin
                </Link>
              )}
              <span className="hidden items-center gap-2 sm:flex">
                <span
                  className="font-display flex h-8 w-8 items-center justify-center rounded-full text-sm text-brass-300"
                  style={{
                    background: 'rgb(196 160 72 / 0.14)',
                    boxShadow: 'inset 0 0 0 1px rgb(196 160 72 / 0.3)',
                  }}
                  aria-hidden
                >
                  {user.firstName.charAt(0)}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-xs font-medium">{user.firstName}</span>
                  <span className="text-[0.625rem] uppercase tracking-[0.14em] text-ivory-dim/70">
                    {user.role}
                  </span>
                </span>
              </span>
              <button
                onClick={() => {
                  clear();
                  window.location.href = '/';
                }}
                className="btn-quiet"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost px-4 py-1.5 text-sm" data-press>
                <LogIn size={15} />
                Sign in
              </Link>
              <Link href={bookHref} className="btn-primary px-4 py-1.5 text-sm" data-press>
                <CalendarCheck size={15} />
                Book now
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const { data } = useQuery({
    queryKey: ['shop-info'],
    queryFn: () => apiJson<{ shops: Shop[] }>('/api/v1/shops?limit=1'),
    staleTime: 5 * 60_000,
  });
  const shop = data?.shops[0];

  return (
    <footer className="mt-20">
      <div className="rule-fade" />
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-3">
        <div>
          <p className="font-display text-2xl">BarberHouse</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ivory-dim">
            A booking house for classic cuts, sharp fades, and unhurried straight-razor shaves.
          </p>
        </div>
        <div>
          <p className="eyebrow mb-3">
            <MapPin size={13} /> Where are we located
          </p>
          <div className="grid gap-1.5 text-sm text-ivory-dim">
            {shop ? (
              <>
                <p className="text-ivory">
                  {shop.addressLine1}, {shop.city}, {shop.state} {shop.postalCode}
                </p>
                <p className="flex items-center gap-2">
                  <Phone size={13} className="text-brass-400" />
                  <span data-numeric>{shop.phone}</span>
                </p>
              </>
            ) : (
              <div className="skeleton h-4 w-48" aria-hidden />
            )}
            <p className="mt-2 flex items-center gap-2">
              <Clock3 size={13} className="text-brass-400" />
              <span data-numeric>Mon – Sat · 9:00 – 18:00</span>
            </p>
            <p className="pl-[1.3rem]" data-numeric>
              Sun · 10:00 – 16:00
            </p>
          </div>
        </div>
        <div>
          <p className="eyebrow mb-3">Explore</p>
          <div className="flex flex-col items-start gap-2 text-sm">
            {[
              { href: '/#services', label: 'Services' },
              { href: '/#barbers', label: 'Barbers' },
              { href: '/dashboard', label: 'My bookings' },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-ivory-dim transition-colors duration-200 hover:text-brass-300"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="rule-fade" />
      <p className="py-6 text-center text-xs tracking-[0.14em] text-ivory-dim/60 uppercase">
        © 2026 BarberHouse · All rights reserved
      </p>
    </footer>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
      <Footer />
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#0e0d0b',
            border: '1px solid rgba(247,242,233,0.12)',
            color: '#f7f2e9',
          },
        }}
      />
    </QueryClientProvider>
  );
}
