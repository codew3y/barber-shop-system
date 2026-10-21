import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

// One typeface for the whole site. Headings are separated from body text by
// weight, size and tracking rather than by a second family — fewer moving
// parts, one less font to download, and nothing competing for attention.
// Italic is requested explicitly so the accent lines get a real italic
// instead of a synthesised slant.
const inter = Inter({
  subsets: ['latin'],
  style: ['normal', 'italic'],
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
    <html lang="en" className={`h-full antialiased ${inter.variable}`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
