import * as Sentry from '@sentry/nextjs';

// TEMPORARY Phase 7 verification route — throws on purpose so we can
// confirm prod errors reach Sentry. Delete after the issue is confirmed.
export async function GET() {
  Sentry.captureMessage('phase7-sentry-verify', 'error');
  throw new Error('phase7-sentry-verify');
}

export async function POST() {
  return GET();
}
