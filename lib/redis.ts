import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis?: Redis };

function createClient(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const client = new Redis(url, { maxRetriesPerRequest: 1, enableReadyCheck: false });
  client.on('error', () => {
    // Avoid unhandled errors during dev when Redis is down; callers fall back gracefully.
  });
  return client;
}

export const redis = globalForRedis.redis ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

// Refresh-token blacklist (rotation / reuse detection). Falls back to
// no-op if Redis is unreachable so auth still works in minimal dev setups.
export async function blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
  try {
    await redis.setex(`blacklist:${jti}`, ttlSeconds, '1');
  } catch {
    // ignore — best effort
  }
}

export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  try {
    return (await redis.get(`blacklist:${jti}`)) === '1';
  } catch {
    return false;
  }
}
