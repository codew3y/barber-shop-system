# Operations Runbook — BarberHouse

How to deploy, migrate, operate, and roll back. Single-brand app on
Vercel (web) + Neon (Postgres) + Upstash (Redis).

## Environments

| Env | URL | DB | Notes |
|---|---|---|---|
| Local | `http://localhost:3000` | Docker Postgres/Redis (`docker compose up -d`) | No keys needed; matches `docker-compose.yml` creds. |
| Prod | `https://barberhouseph.vercel.app` | Neon + Upstash | All secrets in Vercel env. |

There is no separate staging environment yet. Vercel preview deployments
give you throwaway web frontends per PR, but they still point at prod Neon
unless a staging database exists. To add staging (30 min, owner-side):

1. Neon dashboard → Branches → **Create branch** `staging` (optionally with
   a data snapshot from prod).
2. Create a second Upstash database (or reuse prod Redis — staging traffic
   is yours alone, key collisions are unlikely but possible).
3. Vercel → Settings → Environment Variables → add the staging
   `DATABASE_URL` / `DIRECT_URL` / `REDIS_URL` scoped to **Preview**, plus
   test (not live) `PAYMONGO_*` keys and a separate Sentry project DSN.
4. On each PR, Vercel posts a preview URL running the branch code against
   staging data. Run `npx prisma migrate deploy` with the staging URLs
   before opening the preview.

Until then, preview deploys + local docker remain the pre-prod gate.

## Required prod env vars (Vercel)

| Var | Purpose |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Neon pooled + direct connections. |
| `REDIS_URL` | Upstash `rediss://` URL. |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Auth signing (long random strings). |
| `INTERNAL_JOB_KEY` | GitHub Actions cron → `X-Internal-Key`. |
| `PAYMONGO_PUBLIC_KEY` / `PAYMONGO_SECRET_KEY` / `PAYMONGO_WEBHOOK_SECRET` | Live QR Ph money. |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | Gmail SMTP delivery. |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error tracking (server/client). |
| `SENTRY_AUTH_TOKEN` | Optional; enables sourcemap upload at build. Without it builds still succeed (upload disabled). |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push signing. Generate: `node -e "console.log(require('web-push').generateVAPIDKeys())"`. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Same as `VAPID_PUBLIC_KEY`, exposed to browsers for subscriptions. |
| `SLACK_WEBHOOK_URL` | Optional (GitHub secret, not Vercel env); posts uptime-probe failures to Slack. |

## Deploy

1. Merge to `main` → GitHub Actions CI must pass (typecheck, lint, unit, build, e2e) → Vercel auto-deploys.
2. If the merge contains a Prisma migration, apply it to Neon **before or
   immediately after** deploy — either via CLI:
   ```bash
   DATABASE_URL="<neon-pooled>" DIRECT_URL="<neon-direct>" npx prisma migrate deploy
   ```
   or via Actions tab → **Migrate production database** → Run workflow →
   type `migrate` (needs `NEON_DATABASE_URL` / `NEON_DIRECT_URL` repo
   secrets). One missed migration = 500s on affected routes. Migrations
   stay off the Vercel build by design (see "Why not automated" below).
3. Verify: `GET /api/health` → `200 {"status":"ok"}`; Sentry release shows no new issues; run one guest checkout.

## Background jobs

GitHub Actions (`.github/workflows/jobs.yml`) hits `POST /api/v1/jobs/run`
every 10 min with `X-Internal-Key`. Vercel Hobby cron (1/day) is
insufficient — a dropped hold would block a slot up to 24h — so the
schedule lives in Actions by design.

If jobs return non-200: check `INTERNAL_JOB_KEY` secret vs Vercel env,
then `GET /api/health`, then Sentry for `runJobs` errors.

## Monitoring

- **Errors:** Sentry (client/server/edge via `instrumentation.ts` + `global-error.tsx`). Verify a deploy by triggering a test error and confirming it appears in the Sentry project.
- **Uptime:** point any uptime monitor (Sentry Uptime, Better Stack, UptimeRobot) at `GET /api/health`. Alert on non-200 or `checks.database != ok`.
- **Logs:** Vercel runtime logs + structured JSON summaries from job runs + `audit_log` rows for booking cancel/reschedule/status/hold-expiry.
- **Alerting:** no PagerDuty/Slack integration yet (solo-operator scope). Sentry email alerts to the owner + uptime-monitor alerts cover launch. Add Slack webhook when a second operator joins.

## Rollback

Web (Vercel): redeploy the previous good deployment from the Vercel
dashboard (instant, zero-downtime). Then confirm `/api/health` and Sentry.

Database: Prisma migrations are forward-only. Rolling back code that
depends on a new column requires a **corrective migration**, not
`migrate resolve` surgery:
1. Redeploy last good web build (it ignores the new column).
2. Write a follow-up migration removing/neutralizing the breaking change.
3. `migrate deploy` it to Neon, redeploy web, verify checkout end-to-end.

Test this path before launch: deploy → migrate → redeploy previous build
→ confirm the app still serves (7.4 gate).

## Why not automated migrations

Auto-migrate on Vercel build risks half-applied schemas during concurrent
deploys and gives no place to snapshot first. Manual `migrate deploy`
keeps one human confirming `prisma migrate status` against Neon before
each schema change. Automate only after staging + Neon branch exist.

## Incident checklist

1. `/api/health` + Vercel status + Neon/Upstash dashboards.
2. Sentry: newest issue, affected release, first-seen time.
3. Recent deploys / migrations (`git log`, Prisma `_prisma_migrations`).
4. Mitigate (redeploy previous build; pause jobs workflow if it is the cause), then fix forward.
5. Append a row to `docs/PROGRESS.md` session log.
