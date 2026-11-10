-- Re-add non-negative price check constraint for event_spaces using the new price_per_day column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_spaces_non_negative_price'
  ) THEN
    ALTER TABLE "event_spaces" ADD CONSTRAINT "event_spaces_non_negative_price" CHECK ("price_per_day" >= 0);
  END IF;
END $$;

-- Compound index on event_bookings for fast conflict/overlap queries
CREATE INDEX IF NOT EXISTS "event_bookings_space_window_idx" ON "event_bookings"("event_space_id", "start_at", "end_at");

