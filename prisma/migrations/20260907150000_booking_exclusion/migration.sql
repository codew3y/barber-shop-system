-- Double-booking prevention (from PHASE-2-ARCHITECTURE.md).
-- Prisma cannot express exclusion constraints, so we add it as raw SQL.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prevent overlapping bookings for the same staff member
-- (cancelled / no_show bookings are excluded from the check)
ALTER TABLE bookings ADD CONSTRAINT no_overlap_booking
    EXCLUDE USING gist (
        staff_id WITH =,
        tstzrange(start_at, end_at) WITH &&
    ) WHERE (status NOT IN ('cancelled', 'no_show'));

-- Partial index for active bookings (faster availability queries)
CREATE INDEX IF NOT EXISTS idx_bookings_active
    ON bookings(staff_id, start_at, end_at)
    WHERE status IN ('pending', 'confirmed');

-- Index for hold expiration job
CREATE INDEX IF NOT EXISTS idx_bookings_holds
    ON bookings(hold_expires_at)
    WHERE hold_expires_at IS NOT NULL AND status = 'pending';
