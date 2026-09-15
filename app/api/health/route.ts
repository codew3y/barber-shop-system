import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis, redisConfigured } from '@/lib/redis';

// Uptime-monitor target (Sentry Uptime, Better Stack, etc.).
// Returns 200 when the app serves traffic, 503 only when the database is
// unreachable. Redis is reported but never fails the check — the app is
// designed to degrade without it when unconfigured.
export async function GET() {
  const checks: Record<string, string> = {};
  let status = 200;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (err) {
    console.error('[health] database unreachable', err);
    checks.database = 'down';
    status = 503;
  }

  if (redisConfigured) {
    try {
      await redis.ping();
      checks.redis = 'ok';
    } catch (err) {
      console.error('[health] redis unreachable', err);
      checks.redis = 'down';
    }
  } else {
    checks.redis = 'unconfigured';
  }

  return NextResponse.json(
    { status: status === 200 ? 'ok' : 'down', checks, time: new Date().toISOString() },
    { status },
  );
}
