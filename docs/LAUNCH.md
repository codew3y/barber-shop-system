# Launch Checklist — BarberHouse

## Verified 2026-09-15 (local, prod-identical code)

- [x] `typecheck` clean, `lint` 0 errors, 26/26 unit tests pass
- [x] `GET /api/health` → 200, `checks: {database ok, redis ok}`
- [x] Race test `N=8`: 1 created, 7 × 409 — no double-booking
- [x] RBAC/IDOR matrix: 11/11 pass (incl. stored-XSS strip)
- [x] Sentry client/server/edge wired via `instrumentation.ts`; sourcemap upload gated on `SENTRY_AUTH_TOKEN`
- [x] Docs: `API.md`, `OPERATIONS.md` (runbook + rollback + migrations), `USER-GUIDE.md`, `PRIVACY.md`

## Verified 2026-09-15, round 2 (4.3 + 5.2)

- [x] `typecheck` clean, `lint` 0 errors, 32/32 unit tests (prefs resolution + event-bus delivery/dedupe)
- [x] Production `build` green (new `/api/v1/events`, `/api/v1/push/*`, `/api/v1/settings/*` routes)
- [x] Live SSE roundtrip: booking create → `booking.created` on customer stream; cancel → `booking.cancelled`; staff login stream got shop event; unauthenticated stream 401s
- [x] Prefs GET/PUT roundtrip (reminders-off persisted); push sub POST/GET/DELETE roundtrip; push send failure counted without crash or wrongful prune
- [x] New migration `push_and_prefs` applied locally — **must also run against prod Neon** (new `Migrate production database` workflow or CLI) or push/prefs APIs 500 in prod

## Before opening bookings (owner actions)

- [x] **Prod Sentry event:** confirmed 2026-09-15 — temp route threw on prod, issue formed on release `4dcce8f` (`newGroups: 1`); route removed in `07e8627`
- [x] **Uptime monitor:** `Uptime monitor` workflow (every 15 min + manual trigger) ships in `.github/workflows/uptime.yml`; probe logic validated against prod `/api/health`
- [ ] **Rollback drill:** redeploy previous Vercel build → confirm `/api/health` → redeploy current (procedure in `OPERATIONS.md`)
- [ ] **`npm audit fix`** the transitive vulns flagged in `SECURITY.md`, or document exceptions
- [ ] **Live-money rehearsal:** PayMongo test keys → real QR payment → webhook `payment.paid` → refund path, then swap to live keys
- [ ] **Reminder rehearsal:** test booking → confirm 24h/1h emails arrive (SMTP Gmail app password)
- [ ] **Schedule launch window:** low-traffic hour; owner on standby with this file + `OPERATIONS.md` open

## Deliberate deferrals (not launch blockers)

- Staging env + auto-migrations: manual `migrate deploy` against Neon (see `OPERATIONS.md`)
- WebSocket live updates: 15s polling ships; notification prefs deferred
- `middleware.ts` → `proxy` rename: Next deprecation warning only, schedule with next dependency bump
- Sourcemap file upload is a no-op under Turbopack builds (verified 2026-09-15: release auto-created with commits, 0 artifact files — known SDK limitation). Token/org/project confirmed valid; releases + suspect-commits work, stack traces stay minified until upload support lands. No action.
