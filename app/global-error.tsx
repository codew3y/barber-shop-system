'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-full flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="font-display text-2xl">Something went wrong</h1>
        <p className="muted mt-2 text-sm">The house apologizes — try again.</p>
        <button onClick={() => reset()} className="btn-primary mt-6">
          Try again
        </button>
      </body>
    </html>
  );
}
