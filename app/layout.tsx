import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

// Fraunces: a warm old-style serif for display type — heritage grooming,
// not tech startup. Inter carries every piece of UI copy underneath it.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// No `icons` block here on purpose. app/icon.png and app/apple-icon.png are
// picked up by Next's file convention, which serves them with the correct
// MIME type and a content-hashed URL — so a changed logo busts the cache
// instead of leaving a stale icon pinned in the tab.
export const metadata: Metadata = {
  title: 'BarberHouse',
  description: 'BarberHouse — book barber appointments online',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
