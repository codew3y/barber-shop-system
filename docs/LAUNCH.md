# Launch Checklist — BarberHouse

## Verified 2026-09-15 (local, prod-identical code)

- [x] `typecheck` clean, `lint` 0 errors, 26/26 unit tests pass
- [x] `GET /api/health` → 200, `checks: {database ok, redis ok}`
- [x] Race test `N=8`: 1 created, 7 × 409 — no double-booking
- [x] RBAC/IDOR matrix: 11/11 pass (incl. stored-XSS strip)
- [x] Sentry client/server/edge wired via `instrumentation.ts`; sourcemap upload gated on `SENTRY_AUTH_TOKEN`
- [x] Docs: `API.md`, `OPERATIONS.md` (runbook + rollback + migrations), `USER-GUIDE.md`, `PRIVACY.md`

## Before opening bookings (owner actions)

- [ ] **Prod Sentry event:** trigger a test error on the live URL, confirm it appears in the Sentry project (closes 7.4 "verify monitoring")
- [ ] **Uptime monitor:** point Sentry Uptime / Better Stack / UptimeRobot at `GET /api/health`; alert on non-200 (closes 7.2)
- [ ] **Sentry alerts:** confirm issue-alert emails reach the owner; add Slack webhook when a second operator joins
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
