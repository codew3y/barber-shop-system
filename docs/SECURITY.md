# Security Review — BarberHouse (Phase 6)

Date: 2026-09-08. Method: code review + live attack scripts + load test + axe audit.
Run the evidence yourself: `npm run dev`, then
`npx tsx scripts/security-audit.ts` and `N=8 npx tsx scripts/load-test.ts`.

## Results

| Check | Result |
|-------|--------|
| RBAC/IDOR matrix (`scripts/security-audit.ts`) | 11/11 PASS |
| Concurrent-booking race (`scripts/load-test.ts`, 8 parallel same-slot) | exactly 1 created, 7 × 409 — no double-booking |
| axe WCAG 2.1 AA on `/` and `/dashboard` | 0 violations |
| `typecheck` / `lint` (0 errors) / unit 19/19 / `build` / e2e | green |

## OWASP Top 10 mapping

| Threat | Status | Evidence |
|--------|--------|----------|
| A01 Broken Access Control | ✅ enforced | `requireAuth`/`requireRole` on every mutating route; `canActOnBooking` + `isShopAdmin` ownership checks; matrix covers IDOR read/cancel, customer→admin, staff→admin, anon |
| A02 Cryptographic Failures | ✅ | bcrypt-12 passwords; JWT access 15m + rotating refresh with reuse detection; TLS expected in prod (HSTS header set) |
| A03 Injection | ✅ | Prisma ORM everywhere (no raw SQL except vetted seed/cleanup scripts); Zod at every boundary; `lib/sanitize.ts` strips HTML/control chars from stored free text (verified: `<script>` stored as plain text) |
| A04 Insecure Design | ✅ | Exclusion constraint makes double-booking structurally impossible; idempotency keys on booking create; webhook signature verification |
| A05 Misconfiguration | ✅ | `middleware.ts` sets CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy; `.env` git-ignored, `.env.example` documents placeholders |
| A06 Vulnerable Components | ⚠️ watch | `npm audit` shows 13 vulns (5 moderate, 8 high) in transitive deps — scheduled cleanup before launch |
| A07 Auth Failures | ✅ | 5–10/min rate limits on auth endpoints; generic "Invalid credentials" (no enumeration); forgot-password always returns success |
| A08 Data Integrity | ✅ | Stripe webhook signature required (400 without); refresh-token rotation blacklists old JTIs |
| A09 Logging Failures | ✅ | `audit_log` rows on booking cancel/reschedule/status/hold-expiry; structured JSON summaries from job runs |
| A10 SSRF | ✅ | No server-side fetches of user URLs; provider calls fixed to api.sendgrid.com / api.twilio.com / api.stripe.com |

## Deliberate deviations

- **CSRF:** not applicable — auth is Bearer tokens in memory/localStorage, no cookies, so no ambient authority. No action.
- **Rate limiting is in-memory:** correct for single-instance dev; must move to Redis-backed limiting before multi-instance deploy (Phase 7).
- **Race-test burst size 8, not 20:** the booking limiter (10/min/IP) 429s larger bursts — the limiter itself is the outer shield; the 8-way race proves the DB backstop.

## Before launch

1. `npm audit fix` the transitive vulns (or document exceptions).
2. Redis-backed rate limits + `INTERNAL_JOB_KEY`, `STRIPE_*`, `SENDGRID_*`, `TWILIO_*` set.
3. Re-run `scripts/security-audit.ts` against staging.
