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
| M3 — Staff/Admin Dashboard | ✅ Done | 4.1 ✅, 4.2 ✅, 4.3 via 15s polling (WebSocket deferred, push optional) |
| M4 — Payments & Notifications | ✅ Done | 5.1 ✅ (Stripe code live, needs keys), 5.2 ✅ (prefs deferred), 5.3 ✅ (ICS export; Google sync deferred) |
| M5 — Security Hardening & QA | ✅ Done | 6.1–6.3 ✅, `docs/SECURITY.md` (CSRF N/A documented, Redis limits + audit fix flagged for launch) |
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
- [x] **3.5 Customer UI** — single-brand BarberHouse landing (hero, menu, barbers, visit),
      4-step CheckoutFlow (service → staff → slot → checkout with inline guest registration),
      login/register pages, Zustand auth/booking stores, React Query + token-refresh api client.
      (Multi-shop catalog dropped by scope decision — brand-specific project.)
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
| 2026-09-07 | Scope pivot: single-brand project, removed multi-shop catalog (deleted ShopBrowser, home is now BarberHouse landing with menu/barbers/visit). Reseeded BarberHouse shop. Build + e2e green. |
| 2026-09-07 | Squared all buttons/CTAs (rounded-full → subtle rounded) per feedback; avatar circles kept round. |
| 2026-09-07 | Palette swap per feedback: charcoal + crimson (brown/copper gone). Screenshot-verified. |
| 2026-09-07 | Modern type per feedback: Space Grotesk display + Geist body (serif/Arial gone). Screenshot-verified. |
| 2026-09-07 | Removed lower-left "N" watermark (Next.js dev indicator) via devIndicators:false. Verified gone. |
| 2026-09-07 | Per-barber booking: cards show title + original bio summary + "Book with {name}" deep-linking to flow with barber preselected (?staff=). PHP currency end-to-end (₱, payment default). System-sans extrabold type. E2E green. |
| 2026-09-08 | Home content batch: 3 barbers (title field + migration), text-style Book links, services with per-barber pricing + summaries, barbers intro line, scroll-spy nav highlight, footer location block, visit section removed. E2E green. |
| 2026-09-08 | Pushed full local batch to GitHub. Started Phase 4 (staff/admin dashboards). |
| 2026-09-08 | Completed Phase 4 (M3): staff API (schedule/status/time-off/earnings) + /staff UI, admin API (staff/service CRUD, bookings, analytics, settings, shop-wide time-off) + /admin UI, 15s polling for live updates (WebSocket deferred to later). Live-verified all flows; lint 0 errors, build + e2e green. |
| 2026-09-08 | Completed Phase 5 (M4): Stripe intents (deposit/full, 20% default) + signature-verified webhooks + admin refunds; 24h/1h reminders with dedupe + shop opt-out; jobs runner (holds, reminders, no-show + fee, `npm run jobs` + keyed HTTP trigger); ICS download + confirmation link. Live-verified with timed fixtures; 15/15 tests, build + e2e green. Needs Stripe/SMTP keys for live money + delivery. |
| 2026-09-08 | Booking flow redesign: combined Barber & Service step (preselect only via ?staff=), icon step indicators, Continue buttons per step, date-first time picker, service price ranges (₱300–₱350), per-barber price in review, staff filtered by service. E2E green, screenshot-verified. |
| 2026-09-08 | Flow compaction: single Barber\|Service panel (cross-outs both directions), side-by-side date\|time panel with unavailable labels, tighter spacing — fits above the fold. E2E green, screenshot-verified. |
| 2026-09-08 | Fixed 12am-slot bug: slot engine now works in shop timezone (Intl-based, no deps); house moved to Asia/Manila + Quezon City address; SlotPicker formats in shop tz; API returns tz. 19/19 tests, e2e green. |
| 2026-09-08 | Completed Phase 6 (M5): security headers, free-text sanitization, wider rate limits; 11/11 RBAC/IDOR matrix; 8-way race proves no double-booking; axe clean; `docs/SECURITY.md`. Lint 0 errors, build + e2e green. |

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
