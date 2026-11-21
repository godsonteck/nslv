import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const q = async (label, sql) => { try { const r = await p.$queryRawUnsafe(sql); console.log(label, JSON.stringify(r)); } catch (e) { console.log(label, "ERR", e.message); } };
try {
  await q("guest_accounts cols:", `SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='guest_accounts' ORDER BY ordinal_position`);
  await q("message_outbox cols:", `SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='message_outbox' ORDER BY ordinal_position`);
  await q("room_types cols:", `SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='room_types' ORDER BY ordinal_position`);
  await q("reservations new cols:", `SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='reservations' AND column_name IN ('guest_payment_reference','hold_expires_at','payment_submitted_at')`);
  await q("rate_limit_counters cols:", `SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='rate_limit_counters' ORDER BY ordinal_position`);
  await q("_prisma_migrations count:", `SELECT count(*)::int AS n FROM _prisma_migrations`);
  await q("_prisma_migrations all:", `SELECT migration_name, started_at, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at`);
  await q("event_spaces cols:", `SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='event_spaces' ORDER BY ordinal_position`);
  await q("event_bookings idx:", `SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND tablename='event_bookings'`);
} finally { await p.$disconnect(); }
