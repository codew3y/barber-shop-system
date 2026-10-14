import { NextRequest, NextResponse } from 'next/server';
import { runJobs } from '@barberhouse/backend/services/jobs';
import { isJobRequestAuthorized } from '@barberhouse/backend/lib/job-auth';

// Releases expired holds, sends reminders, marks no-shows.
// Triggered by the GitHub Actions scheduler (.github/workflows/jobs.yml),
// Vercel Cron, or any external scheduler.
// The authorization rules live in backend/src/lib/job-auth.ts so they can be tested.
async function handle(req: NextRequest) {
  const auth = isJobRequestAuthorized({
    internalKey: process.env.INTERNAL_JOB_KEY,
    cronSecret: process.env.CRON_SECRET,
    headerInternalKey: req.headers.get('X-Internal-Key'),
    headerAuthorization: req.headers.get('authorization'),
    isProduction: process.env.NODE_ENV === 'production',
  });
  if (!auth.ok) {
    const error = auth.status === 503 ? 'Job runner not configured' : 'Unauthorized';
    return NextResponse.json({ error }, { status: auth.status });
  }
  return NextResponse.json(await runJobs());
}

export async function POST(req: NextRequest) {
  return handle(req);
}

// Vercel Cron issues GET requests, so both verbs share the handler.
export async function GET(req: NextRequest) {
  return handle(req);
}
