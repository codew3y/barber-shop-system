'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="font-display flex h-9 w-9 items-center justify-center rounded-full bg-pine-900 text-lg text-copper-200">
        ✂
      </span>
      <span className="font-display text-lg tracking-wide">BarberHouse</span>
    </Link>
  );
}

function Nav() {
  const { user, ready, clear, hydrate } = useAuthStore();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <header className="sticky top-0 z-10 border-b border-cream/10 bg-pine-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <BrandMark />
        <nav className="flex items-center gap-3 text-sm sm:gap-5">
          <Link href="/#services" className="hidden hover:underline sm:inline">
            Services
          </Link>
          <Link href="/#barbers" className="hidden hover:underline sm:inline">
            Barbers
          </Link>
          <Link href="/#visit" className="hidden hover:underline sm:inline">
            Visit
          </Link>
          {ready && user ? (
            <>
              <Link href="/dashboard" className="hover:underline">
                My bookings
              </Link>
              <span className="hidden text-cream/60 sm:inline">
                {user.firstName} · {user.role}
              </span>
              <button
                onClick={() => {
                  clear();
                  window.location.href = '/';
                }}
                className="rounded-full border border-cream/25 px-3 py-1.5 hover:bg-cream/10"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-cream/25 px-3 py-1.5 hover:bg-cream/10"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-copper-600 px-4 py-1.5 font-medium text-cream hover:bg-copper-700"
              >
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
  return (
    <footer className="mt-12 border-t border-cream/10 bg-black/30 text-cream/80">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 text-sm sm:grid-cols-3">
        <div>
          <p className="font-display text-lg text-cream">BarberHouse</p>
          <p className="mt-2 max-w-xs">
            A booking house for classic cuts, sharp fades, and unhurried straight-razor shaves.
          </p>
        </div>
        <div>
          <p className="mb-2 font-semibold tracking-widest text-copper-200">VISIT</p>
          <p>Walk-ins welcome where the queue allows.</p>
          <p className="mt-1">Mon – Sat · 9:00 – 18:00</p>
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
