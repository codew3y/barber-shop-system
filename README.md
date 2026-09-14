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
- Monitoring: Sentry (needs DSN), GitHub Actions (CI gates + scheduled jobs)

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

| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js lifecycle (`build` = `prisma generate && next build`) |
| `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint |
| `npm test` / `npm run test:e2e` | Vitest unit / Playwright e2e |
| `npm run db:seed` | Seed demo shop |
| `npm run jobs` | Run scheduled jobs (holds, reminders, no-shows) |
| `npx prisma migrate deploy` | Apply pending migrations (prod — see runbook note below) |

## Project docs (`docs/`)

- `PROJECT.md` — build spec with phase checkboxes (Phase 7 in progress)
- `PROGRESS.md` — session log, single source of truth for "where are we?"
- `PHASE-1-RESEARCH.md` / `PHASE-2-ARCHITECTURE.md` — M0/M1 evidence
- `SECURITY.md` — security findings and launch notes

## Deploy notes

- Push to `main` → GitHub Actions CI (typecheck, lint, unit, build, e2e) → Vercel deploys.
- Migrations are **not** automated (`PROJECT.md` 7.1): after merging a migration,
  run `npx prisma migrate deploy` against prod Neon — one missed migration = 500s.
- Scheduled jobs run via GitHub Actions every 10 min (Vercel Hobby cron is
  insufficient); needs `INTERNAL_JOB_KEY` secret + env.
