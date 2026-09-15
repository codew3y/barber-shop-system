# Privacy Policy & Data Retention — BarberHouse

Single-brand barbershop booking. This documents what is stored, why, how
long, and how to exercise rights. Adapt wording with counsel before
publishing as the customer-facing policy.

## Data we collect

| Data | Source | Purpose | Storage |
|---|---|---|---|
| Name, email, phone (optional) | Registration / guest checkout | Identity, confirmations, reminders | `users` table (Neon Postgres) |
| Password hash (bcrypt-12, never plaintext) | Registration / reset | Authentication | `users.password_hash` |
| Bookings (service, barber, time, status, notes) | Booking flow | Fulfilment, schedule, analytics | `bookings` |
| Payments (amount PHP, status, provider refs) | PayMongo QR Ph | Charges, refunds, reconciliation | `payments`. Card/wallet credentials never touch our servers — PayMongo processes them. |
| Notifications (email content, delivery state) | Booking lifecycle | Confirmations, 24h/1h reminders | `notifications` |
| Reviews (rating, comment, anonymous flag) | Post-visit | Social proof | `reviews` |
| Audit trail (actor, action, entity, IP, user-agent) | Mutations | Fraud/abuse investigation | `audit_log` |
| Auth metadata (refresh-token blacklist JTIs) | Sessions | Rotation / reuse detection | Redis (Upstash), TTL-bound |

We do not collect precise location, biometrics, or marketing profiles.
Server-side fetches of user-supplied URLs are never performed (SSRF N/A).

## Processors

Neon (database), Upstash (cache/session), Vercel (hosting/logs), PayMongo
(payments), Gmail SMTP (email delivery), Sentry (error reports — stack
traces may include request context, no passwords).

## Retention

| Data | Retention | Deletion |
|---|---|---|
| Accounts | Life of account + soft-delete (`deletedAt`) | Request deletion → anonymize PII, keep booking refs for records |
| Bookings/payments/notifications | 3 years after completion (tax/dispute window) | Purge or anonymize after window |
| Audit logs | 1 year | Rolling purge |
| Redis session data | TTL expiry (hours–7 days) | Automatic |
| Backups | Per Neon point-in-time-recovery window | Provider-managed |

## Rights (access / correction / deletion / portability)

Email the shop from your booking address. We verify ownership (login or
booking reference + matching email), then respond within 30 days:
export your bookings/payments as JSON/CSV, correct details, or delete /
anonymize your account. Payment records required for tax disputes are
retained in anonymized form.

## Security

bcrypt-12 passwords, 15-min access JWT + rotating 7-day refresh with
reuse detection, RBAC on every mutating route, Zod validation at every
boundary, TLS in transit (HSTS), secrets in Vercel env (never in git).
Report issues to the shop contact address.
