# BarberHouse — Shop Booking System

Single-brand barbershop booking platform: customer checkout flow, staff/admin
dashboards, PayMongo QR Ph payments, reminders, and hardening. Production stack
is Next.js 16 + Prisma 6 (Postgres) + Redis, deployed on Vercel with Neon +
Upstash.

## Tech stack

- Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- Prisma 6 + PostgreSQL (Neon in prod, Docker locally) + Redis (Upstash in prod)
- Auth: JWT access (15m) + rotating refresh (7d, reuse detection), bcrypt-12, RBAC
- Payments: PayMongo QR Ph (dynamic per-transaction QR)
- Notifications: SMTP via Nodemailer, in-app toasts
- Monitoring: Sentry (DSN set, `frontend/instrumentation.ts` + `/api/health`), GitHub Actions (CI gates + scheduled jobs)

## Repository layout

npm-workspaces monorepo. Run every command from the repo root; the root
`.env` is shared by both workspaces. `build`, `start` and `test:e2e` go
through `scripts/with-env.mjs`, which loads that `.env` into the real
environment first — `next build` fans static generation out to worker
processes that would not otherwise see it. Where the environment is injected
instead of file-based (CI, Vercel) the wrapper is a no-op.

```
backend/                 @barberhouse/backend — server logic, no UI
  prisma/                schema, migrations, seed
  src/lib/               auth, prisma, redis, payments, push, rate limiting…
  src/services/          booking, notifications, scheduled jobs
  src/schemas/           zod request validation
  scripts/               jobs runner, load test, security audit
frontend/                @barberhouse/frontend — the Next.js app
  app/                   pages + app/api/* route handlers
  components/ hooks/ stores/ lib/   UI and browser-side code
  public/  e2e/          static assets, Playwright tests
docs/                    API, user guide, privacy, operations
```

The frontend imports server code as `@barberhouse/backend/<lib|services|schemas>/<module>`;
the API route handlers stay in `frontend/app/api` because Next.js serves them.

## Quickstart

```bash
# 1. Start infra (needs Docker Desktop running)
docker compose up -d

# 2. Env + DB
cp .env.example .env
npx prisma migrate dev
npx prisma generate
npm run db:seed   # demo shop

# 3. Dev server
npm run dev

# 4. Verify
npm run typecheck && npm run lint && npm test
```

Local dev needs no keys (matches compose credentials). Live money needs
`PAYMONGO_*` keys; delivery needs `SMTP_*`; error tracking needs `SENTRY_DSN`
— see `.env.example`.

## Scripts

| Command                           | What                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start` | Next.js lifecycle for `frontend/` (`build` = `prisma generate && next build`) |
| `npm run typecheck` / `lint`      | `tsc --noEmit` in both workspaces / ESLint                                    |
| `npm test` / `npm run test:e2e`   | Vitest unit (`backend/`) / Playwright e2e (`frontend/`)                       |
| `npm run db:seed`                 | Seed demo shop                                                                |
| `npm run jobs`                    | Run scheduled jobs (holds, reminders, no-shows)                               |
| `npx prisma migrate deploy`       | Apply pending migrations (prod — see runbook note below)                      |

## Project docs (`docs/`)

- `API.md` — endpoint reference (`/api/v1` + `/api/health`)
- `OPERATIONS.md` — runbook: deploy, migrations, jobs, monitoring, rollback
- `USER-GUIDE.md` — customer/staff/admin how-tos + payments policy
- `PRIVACY.md` — data collection, retention, rights

## Deploy notes

- Push to `main` → GitHub Actions CI (typecheck, lint, unit, build, e2e) → Vercel deploys.
- Vercel project **Root Directory** is `frontend` (Settings → Build and Deployment),
  with "Include files outside the root directory" enabled; Vercel installs the
  workspaces from the repo root.
- Migrations are **not** automated: after merging a migration, run
  `npx prisma migrate deploy` against prod Neon — one missed migration = 500s.
- Scheduled jobs run via GitHub Actions every 10 min (Vercel Hobby cron is
  insufficient); they and the uptime probe need the `APP_URL` repository
  variable plus the `INTERNAL_JOB_KEY` secret + env.
