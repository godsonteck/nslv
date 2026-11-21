// Read-only probe: which pending-migration objects already exist in prod?
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const checks = [
  ["event_spaces.price_per_day", `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='event_spaces' AND column_name='price_per_day') AS v`],
  ["event_spaces.price_per_hour", `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='event_spaces' AND column_name='price_per_hour') AS v`],
  ["rate_limit_counters table", `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name='rate_limit_counters') AS v`],
  ["room_types.image_urls", `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='room_types' AND column_name='image_urls') AS v`],
  ["room_types.short_description", `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='room_types' AND column_name='short_description') AS v`],
  ["reservations.hold_expires_at", `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='reservations' AND column_name='hold_expires_at') AS v`],
  ["guest_accounts table", `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name='guest_accounts') AS v`],
  ["message_outbox table", `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name='message_outbox') AS v`],
  ["event_spaces_non_negative_price constraint", `SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='event_spaces_non_negative_price') AS v`],
];

try {
  for (const [label, sql] of checks) {
    const rows = await prisma.$queryRawUnsafe(sql);
    console.log(`${rows[0].v ? "EXISTS   " : "MISSING  "} ${label}`);
  }
  const applied = await prisma.$queryRawUnsafe(
    `SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC NULLS LAST LIMIT 8`
  );
  console.log("\nLast applied migrations:");
  for (const r of applied) console.log(`  ${r.migration_name}  finished=${r.finished_at ?? "NULL"}`);
} catch (e) {
  console.error("PROBE FAILED:", e.message);
} finally {
  await prisma.$disconnect();
}
