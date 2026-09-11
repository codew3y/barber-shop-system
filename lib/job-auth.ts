/**
 * Authorization for the background-job trigger.
 *
 * Pure so it can be tested without standing up a server: the route passes in
 * the headers and the environment, and this decides.
 *
 * Two credentials are accepted because Vercel Cron cannot send custom
 * headers — it sends `Authorization: Bearer $CRON_SECRET`:
 *   - `X-Internal-Key: INTERNAL_JOB_KEY`  for external schedulers and curl
 *   - `Authorization: Bearer CRON_SECRET` for Vercel Cron
 */
export type JobAuthResult = { ok: true } | { ok: false; status: 401 | 503 };

export function isJobRequestAuthorized(input: {
  internalKey?: string;
  cronSecret?: string;
  headerInternalKey: string | null;
  headerAuthorization: string | null;
  isProduction: boolean;
}): JobAuthResult {
  const { internalKey, cronSecret, headerInternalKey, headerAuthorization, isProduction } = input;

  if (internalKey && headerInternalKey === internalKey) return { ok: true };
  if (cronSecret && headerAuthorization === `Bearer ${cronSecret}`) return { ok: true };

  // A secret is configured but the caller did not present it.
  if (internalKey || cronSecret) return { ok: false, status: 401 };

  // Nothing configured: refuse in production, allow locally.
  if (isProduction) return { ok: false, status: 503 };
  return { ok: true };
}
