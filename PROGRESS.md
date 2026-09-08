# Progress Tracker — Barber Shop Booking System

> Update this file at the end of every work session. Single source of truth for
> "where are we?" alongside `PROJECT.md` checkboxes.

## Current Standing

**Phase 3 in progress** — Auth & Core Booking MVP (M2). Phases 1–2 approved and done.

| Milestone | Status | Evidence |
|-----------|--------|----------|
| M0 — Discovery Complete | ✅ Done | `PHASE-1-RESEARCH.md`, `PROJECT.md` 1.1–1.5 `[x]` |
| M1 — Architecture & Schema Locked | ✅ Done | `PHASE-2-ARCHITECTURE.md`, `PROJECT.md` 2.1–2.5 `[x]` |
| M2 — Auth & Core Booking MVP | ✅ Done | 3.1–3.6 ✅, e2e green |
| M3 — Staff/Admin Dashboard | ⬜ | Phase 4 |
| M4 — Payments & Notifications | ⬜ | Phase 5 |
| M5 — Security Hardening & QA | ⬜ | Phase 6 |
| M6 — Deployment & Monitoring | ⬜ | Phase 7 |

### Phase 3 detail

- [x] **3.1 Project Setup** — Next.js 16 + TS + Tailwind, Prisma 6, ESLint/Prettier/Husky,
      Vitest + Playwright, `docker-compose.yml` (postgres:16-alpine, redis:7-alpine).
      `typecheck` + `build` pass.
- [x] **3.2 Database** — `prisma/schema.prisma` (12 models from Phase-2 ERD).
      Migrations: `20260907145303_init` (tables), `20260907150000_booking_exclusion`
      (`btree_gist`, `no_overlap_booking` constraint, partial indexes). DB verified in sync.
- [x] **3.3 Auth** — `app/api/v1/auth/` (register, login, refresh, logout,
      forgot-password, reset-password, me). JWT access 15m + refresh 7d with Redis
      rotation/reuse detection, bcrypt-12, Zod validation, rate limits, RBAC helpers
      (`lib/api.ts`, `lib/rbac.ts`). Live-tested end-to-end; `passwordHash` leak fixed.
      Tests: 7/7 pass.
- [x] **3.4 Core Booking API** — `GET /shops`, `GET /shops/:id` (+services/staff),
      availability slots (15-min steps, Honors hours/time-off/lead-time), `POST /bookings`
      (10-min hold, Idempotency-Key, 409 on race via exclusion constraint),
      `GET /bookings/mine`, `GET /bookings/:id`, cancel + reschedule with audit log
      and owner/staff/admin permission checks. Live-tested full lifecycle; 12/12 tests.
      `prisma/seed.ts` demo shop (`npm run db:seed`).
- [x] **3.5 Customer UI** — home ShopBrowser, shop detail, 4-step CheckoutFlow
      (service → staff → slot → checkout with inline guest registration), login/register
      pages, Zustand auth/booking stores, React Query + token-refresh api client.
- [x] **3.6 Confirmations** — confirmation page (booking + notification states),
      dashboard (upcoming/history + cancel), notification rows queued on
      create/cancel/reschedule. SendGrid/Twilio send paths implemented; without keys
      rows stay `pending` (delivery + reminders land in Phase 5).
      E2E guest flow green (`e2e/booking.spec.ts`).

## Session Log

| Date | What was done |
|------|---------------|
| 2026-09-07 | Approved Phases 1–2. Completed 3.1 (scaffold, Prisma 6 downgrade from v8 RC, configs), 3.2 (schema + 2 migrations, exclusion constraint verified in PG), 3.3 (auth API + live verification). Docker Desktop + compose running. Created PROGRESS.md, git repo initialized. |
| 2026-09-07 | Completed 3.4 (booking schemas/service, shop + booking endpoints, idempotency, seed script). Live-verified: browse → availability → book → double-book 409 → idempotent retry → reschedule → cancel → slot freed; RBAC 403/401/400 paths. 12/12 tests, build green. |
| 2026-09-07 | Completed 3.5 + 3.6 (UI flow, guest checkout, notifications, confirmation, dashboard). Playwright e2e guest booking green; fixed params-unwrap warning. M2 COMPLETE — Phase 3 done. Next: Phase 4 staff/admin dashboards. |
| 2026-09-07 | UI restyle inspired by gentlemensquarter layout (badge hero, dual CTA, feature trio, catalog) with own theme: cream/pine-green/copper + serif display ("The Grooming Ledger"). Build + e2e green, screenshot-verified. |
| 2026-09-07 | Renamed brand to BarberHouse (nav, footer, metadata, package name). Initialized git, first push to github.com/codew3y/barber-shop-system. |

## Quickstart (fresh machine / resume)

```bash
# 1. Start infra (needs Docker Desktop running)
docker compose up -d

# 2. Apply migrations + generate client
npx prisma migrate dev
npx prisma generate

# 3. Dev server
npm run dev

# 4. Verify
npm run typecheck && npm run lint && npm test
```

`.env` needs no changes for local dev (matches compose credentials; Stripe keys only needed in Phase 5).

## Tracking Convention

1. Check off items in `PROJECT.md` (`[ ]` → `[x]`) as steps complete.
2. Append a row to **Session Log** above at the end of each session.
3. Update **Current Standing / Phase 3 detail** when a step flips.
4. Commit with message like `chore: progress 3.3 auth complete`.
