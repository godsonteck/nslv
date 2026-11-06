-- Shared rate-limit counters (used when no Redis REST endpoint is configured).
-- The server also creates this table lazily with IF NOT EXISTS, so deployments
-- that only run `prisma generate` still get shared counters on first request.

CREATE TABLE IF NOT EXISTS "rate_limit_counters" (
  "key" TEXT NOT NULL,
  "total_hits" INTEGER NOT NULL,
  "reset_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("key")
);
