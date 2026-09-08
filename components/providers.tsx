'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CalendarCheck, LogIn, MapPin } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiJson } from '@/lib/api-client';
import type { Shop } from '@/lib/types';

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="font-display flex h-9 w-9 items-center justify-center rounded-full bg-pine-900 text-lg text-copper-200">
        ✂
      </span>
      <span className="font-display text-lg uppercase tracking-wide">BarberHouse</span>
    </Link>
  );
}

function Nav() {
  const { user, ready, clear, hydrate } = useAuthStore();
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState('');
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

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
    return () => observer.disconnect();
  }, [pathname]);

  const linkActive = (id: string) => pathname === '/' && activeSection === id;

  const linkClass = (active: boolean) =>
    `hidden font-semibold hover:underline sm:inline ${active ? 'text-copper-500' : ''}`;

  return (
    <header className="sticky top-0 z-10 border-b border-cream/10 bg-pine-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <BrandMark />
        <nav className="flex items-center gap-3 text-sm sm:gap-5">
          <Link href="/#services" className={linkClass(linkActive('services'))}>
            Services
          </Link>
          <Link href="/#barbers" className={linkClass(linkActive('barbers'))}>
            Barbers
          </Link>
          {ready && user ? (
            <>
              <Link href="/dashboard" className="hover:underline">
                My bookings
              </Link>
              {(user.role === 'staff' || user.role === 'admin' || user.role === 'super_admin') && (
                <Link href="/staff" className="hover:underline">
                  Staff
                </Link>
              )}
              {(user.role === 'admin' || user.role === 'super_admin') && (
                <Link href="/admin" className="hover:underline">
                  Admin
                </Link>
              )}
              <span className="hidden text-cream/60 sm:inline">
                {user.firstName} · {user.role}
              </span>
              <button
                onClick={() => {
                  clear();
                  window.location.href = '/';
                }}
                className="rounded border border-cream/25 px-3 py-1.5 hover:bg-cream/10"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded border border-cream/25 px-3 py-1.5 hover:bg-cream/10"
              >
                <LogIn size={15} />
                Sign in
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 rounded bg-copper-600 px-4 py-1.5 font-medium text-cream hover:bg-copper-700"
              >
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
    <footer className="mt-12 border-t border-cream/10 bg-black/30 text-cream/80">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 text-sm sm:grid-cols-3">
        <div>
          <p className="font-display text-lg uppercase text-cream">BarberHouse</p>
          <p className="mt-2 max-w-xs">
            A booking house for classic cuts, sharp fades, and unhurried straight-razor shaves.
          </p>
        </div>
        <div>
          <p className="mb-2 flex items-center gap-1.5 font-semibold tracking-widest text-copper-200">
            <MapPin size={14} /> WHERE ARE WE LOCATED
          </p>
          {shop ? (
            <>
              <p>{shop.addressLine1}, {shop.city}, {shop.state} {shop.postalCode}</p>
              <p className="mt-1">{shop.phone}</p>
            </>
          ) : (
            <p>Loading address…</p>
          )}
          <p className="mt-1">Mon – Sat · 9:00 – 18:00</p>
          <p>Sun · 10:00 – 16:00</p>
        </div>
        <div>
          <p className="mb-2 font-semibold tracking-widest text-copper-200">EXPLORE</p>
          <p className="flex flex-col gap-1">
            <Link href="/#services" className="hover:underline">Services</Link>
            <Link href="/#barbers" className="hover:underline">Barbers</Link>
            <Link href="/dashboard" className="hover:underline">My bookings</Link>
          </p>
        </div>
      </div>
      <p className="border-t border-cream/10 py-4 text-center text-xs">
        © 2026 BarberHouse. All rights reserved.
      </p>
    </footer>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <Footer />
    </QueryClientProvider>
  );
}
