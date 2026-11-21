import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
try {
  const rooms = await p.$queryRawUnsafe(`SELECT name, base_price, is_active FROM room_types`);
  console.log("room_types:", JSON.stringify(rooms));
  const n = await p.$queryRawUnsafe(`SELECT count(*)::int AS n FROM reservations`);
  console.log("reservations:", JSON.stringify(n));
} catch (e) { console.log("ERR", e.message); } finally { await p.$disconnect(); }
