-- Rename price_per_hour to price_per_day
-- This migration converts event space pricing from per-hour to per-day

-- Step 1: Add new price_per_day column with same default value
ALTER TABLE "event_spaces" ADD "price_per_day" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Step 2: Copy data from price_per_hour to price_per_day
-- (Same numerical value, now interpreted as per-day rate)
UPDATE "event_spaces" SET "price_per_day" = "price_per_hour";

-- Step 3: Drop the old price_per_hour column
ALTER TABLE "event_spaces" DROP COLUMN "price_per_hour";