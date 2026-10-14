import { NextRequest, NextResponse } from 'next/server';

// Global edge middleware: security headers on every response.
// API auth is Bearer tokens; the only cookies (refresh, live-events, session
// hint) are SameSite=Strict and path-scoped, so cross-site requests never
// carry them (no CSRF surface).
const isDev = process.env.NODE_ENV === 'development';

// No nonces: they would force every page to render per request and disable
// the static/ISR pages. 'unsafe-eval' is only needed by React in development.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  // Sentry's browser SDK reports straight to its ingest hosts.
  "connect-src 'self' https://api.paymongo.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.headers.set('Content-Security-Policy', CSP);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
