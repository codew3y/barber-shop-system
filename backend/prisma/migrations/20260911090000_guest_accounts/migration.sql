-- Guest accounts: bookings made without registering.
-- Each guest keeps their own row (keyed by email/phone) so two walk-ins are
-- never merged into one account; this flag only marks how it was created.
ALTER TABLE "users" ADD COLUMN "is_guest" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing synthetic guest placeholders used a .local address.
UPDATE "users" SET "is_guest" = true WHERE "email" LIKE '%@barberhouse.local';
