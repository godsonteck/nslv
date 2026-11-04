-- ============================================
-- PREPARED MIGRATION — DO NOT RUN BLINDLY
-- ============================================
--
-- event_spaces.price_per_day is the last monetary column stored as a
-- double-precision float. Floating point cannot represent 0.10 exactly, so a
-- rate entered as 1234.10 can be stored as 1234.0999999999999 and then drift
-- once it is multiplied by nights and guests.
--
-- This file is deliberately NOT part of prisma/migrations: the deploy pipeline
-- runs `prisma generate` only, and applying this by hand rewrites a live money
-- column. Take a verified `pg_dump` first (the in-app JSON snapshot is not a
-- substitute), then run the steps below in order.
--
-- After the column is numeric, change schema.prisma:
--
--   pricePerDay Decimal @default(0) @map("price_per_day") @db.Decimal(12, 2)
--
-- and rebuild the client. events.service.ts then needs to pass a
-- Prisma.Decimal through calculateBookingPrice instead of multiplying a number.

-- STEP 1 — Preflight. Any row returned here would be silently rounded.
SELECT id, name, price_per_day
FROM event_spaces
WHERE price_per_day <> round(price_per_day::numeric, 2)
ORDER BY price_per_day;

-- STEP 2 — Optional: keep the exact values for the audit trail.
CREATE TABLE IF NOT EXISTS event_spaces_rate_backup AS
SELECT id, price_per_day, now() AS captured_at
FROM event_spaces;

-- STEP 3 — Rewrite the column. The lock is brief on this table (a handful of
-- rows); run it in a maintenance window anyway.
BEGIN;
ALTER TABLE event_spaces
  ALTER COLUMN price_per_day TYPE numeric(12, 2)
  USING round(price_per_day::numeric, 2);
COMMIT;

-- STEP 4 — Verify nothing drifted.
SELECT id, name, price_per_day
FROM event_spaces
ORDER BY name;
