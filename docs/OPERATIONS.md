# Operations Runbook — BarberHouse

How to deploy, migrate, operate, and roll back. Single-brand app on
Vercel (web) + Neon (Postgres) + Upstash (Redis).

## Environments

| Env | URL | DB | Notes |
|---|---|---|---|
| Local | `http://localhost:3000` | Docker Postgres/Redis (`docker compose up -d`) | No keys needed; matches `docker-compose.yml` creds. |
| Prod | `https://barberhouseph.vercel.app` | Neon + Upstash | All secrets in Vercel env. |

There is no separate staging environment (deliberate, Phase 7): Vercel
preview deployments + `migrate deploy` against Neon are the pre-prod gate.
Revisit when a second Neon branch is affordable.

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

## Deploy

1. Merge to `main` → GitHub Actions CI must pass (typecheck, lint, unit, build, e2e) → Vercel auto-deploys.
2. If the merge contains a Prisma migration, apply it to Neon **before or
   immediately after** deploy:
   ```bash
   DATABASE_URL="<neon-pooled>" DIRECT_URL="<neon-direct>" npx prisma migrate deploy
   ```
   One missed migration = 500s on affected routes. Migrations are manual
   by design (see "Why not automated" below).
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
