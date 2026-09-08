import { NextRequest, NextResponse } from 'next/server';
import { runJobs } from '@/services/jobs';

// Protected job trigger for external schedulers.
// Set INTERNAL_JOB_KEY; requests must send it as X-Internal-Key.
// (Without a key configured, only non-production may trigger.)
export async function POST(req: NextRequest) {
  const configured = process.env.INTERNAL_JOB_KEY;
  if (configured) {
    if (req.headers.get('X-Internal-Key') !== configured) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Job runner not configured' }, { status: 503 });
  }
  const summary = await runJobs();
  return NextResponse.json(summary);
}
