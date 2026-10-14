import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis?: Redis };

/**
 * Whether a Redis instance is actually configured for this environment.
 *
 * This is the switch that decides how failures are treated. When Redis is
 * configured we assume it is load-bearing and fail *closed* — a security
 * control that silently degrades to nothing is worse than one that errors.
 * When it is absent (local dev, CI) the helpers degrade quietly so the app
 * still runs without a Redis server.
 */
export const redisConfigured = !!process.env.REDIS_URL;

function createClient(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const client = new Redis(url, { maxRetriesPerRequest: 1, enableReadyCheck: false });
  client.on('error', () => {
    // Avoid unhandled errors during dev when Redis is down; callers decide
    // what a failure means via redisConfigured.
  });
  return client;
}

export const redis = globalForRedis.redis ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

/** Raised when Redis is configured but unreachable. Callers must not swallow it. */
export class RedisUnavailableError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`Redis unavailable during ${operation}`);
    this.name = 'RedisUnavailableError';
    this.cause = cause;
  }
}

// Refresh-token blacklist (rotation / reuse detection). The value records
// why the jti is dead: '1' = revoked (logout), otherwise the epoch ms it was
// rotated at (see refreshReuseAllowed in auth.ts).
export async function blacklistToken(jti: string, ttlSeconds: number, rotatedAtMs?: number): Promise<void> {
  try {
    await redis.setex(`blacklist:${jti}`, ttlSeconds, rotatedAtMs ? String(rotatedAtMs) : '1');
  } catch (err) {
    if (redisConfigured) {
      // Failing to record the old jti means the token stays replayable.
      console.error('[redis] failed to blacklist refresh token', err);
      throw new RedisUnavailableError('blacklistToken', err);
    }
    // Unconfigured: no-op so minimal dev setups still work.
  }
}

export async function getBlacklistEntry(jti: string): Promise<string | null> {
  try {
    return await redis.get(`blacklist:${jti}`);
  } catch (err) {
    if (redisConfigured) {
      // Cannot prove the token is unused — refuse rather than allow a replay.
      console.error('[redis] failed to check refresh-token blacklist', err);
      throw new RedisUnavailableError('getBlacklistEntry', err);
    }
    return null;
  }
}

// Session families: every refresh token from one sign-in shares a family id
// (`fid`). Logout, or reuse outside the grace window, revokes the family so
// no token in that chain — older or newer — can be refreshed again.
export async function revokeFamily(fid: string, ttlSeconds: number): Promise<void> {
  try {
    await redis.setex(`family-revoked:${fid}`, ttlSeconds, '1');
  } catch (err) {
    if (redisConfigured) {
      console.error('[redis] failed to revoke session family', err);
      throw new RedisUnavailableError('revokeFamily', err);
    }
  }
}

export async function isFamilyRevoked(fid: string): Promise<boolean> {
  try {
    return (await redis.get(`family-revoked:${fid}`)) === '1';
  } catch (err) {
    if (redisConfigured) {
      console.error('[redis] failed to check session family', err);
      throw new RedisUnavailableError('isFamilyRevoked', err);
    }
    return false;
  }
}
