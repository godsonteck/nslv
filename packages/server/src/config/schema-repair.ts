// ============================================
// NS LUXURY VILLA — Narrow runtime schema repair
// ============================================
//
// A server build can reach production before its separately managed database
// migrations are applied. When that happens the Events API answers
// `503 DATABASE_SCHEMA_OUTDATED` and the Venues page cannot list anything.
//
// This guard repairs exactly one known, additive drift: the missing
// `event_spaces.price_per_day` column from
// `20260823200000_change_event_pricing_from_hour_to_day`. It only ever adds a
// column and copies the legacy value into it — it never drops or deletes data.
// Once the official migration is applied this becomes a single cheap
// `information_schema` probe per server instance.
//
// The guard never throws: if the database role is not allowed to run DDL the
// original Prisma error is left to surface honestly through the error
// middleware instead of being disguised.

import { prisma } from './database';

const RETRY_AFTER_FAILURE_MS = 60_000;

const EVENT_SPACES_TABLE = 'event_spaces';
const PRICING_COLUMN = 'price_per_day';
const LEGACY_PRICING_COLUMN = 'price_per_hour';

interface TableShape {
  hasTable: boolean;
  hasPricingColumn: boolean;
  hasLegacyPricingColumn: boolean;
}

let repaired = false;
let inFlight: Promise<boolean> | undefined;
let retryAfter = 0;
let warned = false;

const COLUMN_PROBE_SQL = `
  SELECT
    EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = '${EVENT_SPACES_TABLE}'
    ) AS "hasTable",
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = '${EVENT_SPACES_TABLE}'
        AND column_name = '${PRICING_COLUMN}'
    ) AS "hasPricingColumn",
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = '${EVENT_SPACES_TABLE}'
        AND column_name = '${LEGACY_PRICING_COLUMN}'
    ) AS "hasLegacyPricingColumn"
`;

async function probeTableShape(): Promise<TableShape> {
  const rows = await prisma.$queryRawUnsafe<TableShape[]>(COLUMN_PROBE_SQL);
  const row = rows[0];
  return {
    hasTable: row?.hasTable === true,
    hasPricingColumn: row?.hasPricingColumn === true,
    hasLegacyPricingColumn: row?.hasLegacyPricingColumn === true,
  };
}

async function addPricingColumn(shape: TableShape): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      // Do not let a locked table stall an API request behind a long DDL wait.
      await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '4000ms'`);
      await tx.$executeRawUnsafe(
        `ALTER TABLE "${EVENT_SPACES_TABLE}" ADD COLUMN IF NOT EXISTS "${PRICING_COLUMN}" DOUBLE PRECISION NOT NULL DEFAULT 0`,
      );
      if (shape.hasLegacyPricingColumn) {
        // Preserve the configured rate: the value keeps its number and simply
        // changes meaning from per-hour to per-day.
        await tx.$executeRawUnsafe(
          `UPDATE "${EVENT_SPACES_TABLE}"
             SET "${PRICING_COLUMN}" = "${LEGACY_PRICING_COLUMN}"
           WHERE "${PRICING_COLUMN}" = 0 AND "${LEGACY_PRICING_COLUMN}" <> 0`,
        );
      }
      await tx.$executeRawUnsafe(
        `DO $$ BEGIN
           IF NOT EXISTS (
             SELECT 1 FROM pg_constraint WHERE conname = 'event_spaces_non_negative_price'
           ) THEN
             ALTER TABLE "${EVENT_SPACES_TABLE}" ADD CONSTRAINT "event_spaces_non_negative_price" CHECK ("${PRICING_COLUMN}" >= 0);
           END IF;
         END $$;`,
      );
    },
    { timeout: 15_000 },
  );
}

async function runRepair(): Promise<boolean> {
  const shape = await probeTableShape();

  // A missing table is a different, older failure. Leave it to Prisma so the
  // error middleware can report the truth instead of inventing a table.
  if (!shape.hasTable || shape.hasPricingColumn) return true;

  await addPricingColumn(shape);
  console.warn(
    `[schema] added ${EVENT_SPACES_TABLE}.${PRICING_COLUMN}; run \`prisma migrate deploy\` and mark 20260823200000_change_event_pricing_from_hour_to_day as applied to reconcile migration history.`,
  );
  return true;
}

/**
 * Ensure the Events/Venues tables expose `price_per_day`.
 *
 * Returns `true` when the schema is usable (already correct or repaired) and
 * `false` when the repair could not be attempted. Failures are logged once and
 * retried after a short backoff so a transient lock cannot poison the process.
 */
export function ensureEventSpacePricingSchema(): Promise<boolean> {
  if (repaired) return Promise.resolve(true);
  if (Date.now() < retryAfter) return Promise.resolve(false);
  if (inFlight) return inFlight;

  inFlight = runRepair()
    .then((ok) => {
      repaired = ok;
      return ok;
    })
    .catch((error) => {
      retryAfter = Date.now() + RETRY_AFTER_FAILURE_MS;
      if (!warned) {
        warned = true;
        console.error(
          `[schema] could not repair ${EVENT_SPACES_TABLE}.${PRICING_COLUMN}; the official migration is still required:`,
          error,
        );
      }
      return false;
    })
    .finally(() => {
      inFlight = undefined;
    });

  return inFlight;
}

/** Test hook — resets the cached probe state. */
export function resetEventSpaceSchemaCacheForTests(): void {
  repaired = false;
  inFlight = undefined;
  retryAfter = 0;
  warned = false;
}
