# API Reference — BarberHouse (`/api/v1`)

Base URL: `https://<app>/api/v1`. All bodies are JSON. Auth is a Bearer
access JWT (`Authorization: Bearer <token>`, 15 min expiry); refresh via
`POST /auth/refresh` with the rotating refresh token (7d, reuse-detected).
Roles: `customer`, `staff`, `admin`. Validation failures return `400` with
Zod details; forbidden returns `403`; double-booked slots return `409`.

## Ops

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | none | Uptime-monitor target. `200 {status:"ok"}` when DB reachable; `503` when DB down. Redis reported in `checks` but never fails the probe. |

## Auth (`/auth`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | none | Create account (rate-limited). |
| POST | `/auth/guest` | none | Guest account for checkout (email capture). |
| POST | `/auth/login` | none | Returns access + refresh tokens (rate-limited). |
| POST | `/auth/refresh` | refresh token | Rotates pair; reuse flags the session. |
| POST | `/auth/logout` | access | Blacklists refresh JTI. |
| POST | `/auth/forgot-password` | none | Always returns success (no enumeration). |
| POST | `/auth/reset-password` | reset token | Sets new password. |
| GET | `/auth/me` | access | Current user. |

## Shops & availability (public)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/shops` | none | Active shops (`?city&state&page&limit`). |
| GET | `/shops/:shopId` | none | Shop detail. |
| GET | `/shops/:shopId/services` | none | Billable services. |
| GET | `/shops/:shopId/staff` | none | Bookable barbers. |
| GET | `/shops/:shopId/staff/:staffId/availability?date=YYYY-MM-DD` | none | 15-min slots in shop timezone; honors hours, time-off, lead time. |

## Bookings

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/bookings` | access/guest | 10-min hold. Requires `Idempotency-Key` header; `409` on raced slot (exclusion constraint). |
| GET | `/bookings/mine` | access | Caller's upcoming/history. |
| GET | `/bookings/:id` | owner/staff/admin | Detail (ownership-checked). |
| GET | `/bookings/:id/ics` | owner/staff/admin | ICS calendar download. |
| POST | `/bookings/:id/cancel` | owner/staff/admin | `{reason?}`; writes audit log. |
| POST | `/bookings/:id/reschedule` | owner/staff/admin | `{startAt}`; re-checks conflicts; writes audit log. |

## Payments (PayMongo QR Ph)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/payments/create-intent` | access/guest | Creates booking + PayMongo intent; returns QR image + booking ref. |
| GET | `/payments/qr?ref=` | access/guest | QR payload for an intent. |
| POST | `/payments/webhook` | PayMongo signature | Handles `payment.paid` / `payment.failed` / `qrph.expired`. |
| POST | `/payments/:id/refund` | admin | Resolves provider charge, issues refund per policy. |

## Staff (`/staff`, role `staff`+)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/staff/schedule` | staff | Daily schedule view. |
| POST | `/staff/schedule/:bookingId/status` | staff | Accept/reject/complete/no-show. |
| GET/POST | `/staff/time-off` | staff | List/request time off. |
| DELETE | `/staff/time-off/:id` | staff | Withdraw request. |
| GET | `/staff/earnings` | staff | Earnings view. |

## Admin (`/admin`, role `admin`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET/POST | `/admin/staff` | admin | Staff CRUD. |
| PATCH/DELETE | `/admin/staff/:staffId` | admin | Update/deactivate. |
| GET/POST | `/admin/services` | admin | Service/pricing CRUD. |
| PATCH/DELETE | `/admin/services/:serviceId` | admin | Update/remove. |
| GET | `/admin/bookings` | admin | Shop-wide bookings. |
| GET | `/admin/analytics` | admin | Revenue + utilization. |
| GET/PATCH | `/admin/shop/settings` | admin | Booking rules, hours, opt-outs. |
| GET/POST | `/admin/time-off` | admin | Shop-wide time-off. |

## Jobs (automation, not browsers)

`POST /jobs/run` (GET also accepted for Vercel Cron) releases expired
holds, dispatches 24h/1h reminders, and marks no-shows. Auth: `X-Internal-Key:
<INTERNAL_JOB_KEY>` (GitHub Actions) or `Authorization: Bearer <CRON_SECRET>`
(Vercel Cron). Returns `503` when no key is configured, `401` on mismatch.
