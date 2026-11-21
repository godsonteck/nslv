import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const q = async (label, sql) => { try { const r = await p.$queryRawUnsafe(sql); console.log(label, JSON.stringify(r)); } catch (e) { console.log(label, "ERR", e.message); } };
try {
  await q("price data match?", `SELECT count(*)::int AS rows, count(*) FILTER (WHERE price_per_day = price_per_hour)::int AS same, count(*) FILTER (WHERE price_per_day <> price_per_hour)::int AS diff, count(*) FILTER (WHERE price_per_day = 0 AND price_per_hour <> 0)::int AS unfilled FROM event_spaces`);
  await q("price sample:", `SELECT name, price_per_hour, price_per_day FROM event_spaces`);
  await q("public_guest_booking indexes:", `SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND tablename IN ('guest_accounts','guest_sessions','guest_auth_tokens','message_outbox','reservations') ORDER BY tablename, indexname`);
  await q("public_guest_booking fks:", `SELECT conname FROM pg_constraint WHERE conrelid::regclass::text IN ('guest_accounts','guest_sessions','guest_auth_tokens') AND contype='f'`);
  await q("guest_accounts has guest_id?", `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='guest_accounts' AND column_name='guest_id') AS v`);
  await q("event_bookings_space_window_idx:", `SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname=current_schema() AND tablename='event_bookings' AND indexname='event_bookings_space_window_idx') AS v`);
  await q("event_spaces constraint:", `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='event_spaces_non_negative_price'`);
  await q("enums:", `SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS vals FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typname IN ('GuestAccountStatus','GuestAuthTokenType','MessageChannel','MessageStatus') GROUP BY t.typname`);
} finally { await p.$disconnect(); }
