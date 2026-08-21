-- Reception cash-at-hand register and its auditable movement ledger.
CREATE TYPE "CashEntryType" AS ENUM ('OPENING', 'INFLOW', 'OUTFLOW');

CREATE TABLE "cash_registers" (
  "id" TEXT NOT NULL,
  "business_date" TIMESTAMP(3) NOT NULL,
  "opening_cash" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "closed_by" TEXT,
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cash_registers_business_date_key" ON "cash_registers"("business_date");

CREATE TABLE "cash_register_entries" (
  "id" TEXT NOT NULL,
  "cash_register_id" TEXT NOT NULL,
  "type" "CashEntryType" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT,
  "recipient" TEXT,
  "receipt_ref" TEXT,
  "recorded_by" TEXT NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_register_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_register_entries_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "cash_register_entries_cash_register_id_idx" ON "cash_register_entries"("cash_register_id");
CREATE INDEX "cash_register_entries_type_idx" ON "cash_register_entries"("type");
CREATE INDEX "cash_register_entries_recorded_at_idx" ON "cash_register_entries"("recorded_at");

-- Backfill the two permissions and grant them to existing Reception roles.
INSERT INTO "permissions" ("id", "code", "module", "action", "description")
VALUES
  ('nslv-permission-cash-register-view', 'cash_register.view', 'cash_register', 'view', 'View cash register / float'),
  ('nslv-permission-cash-register-manage', 'cash_register.manage', 'cash_register', 'manage', 'Manage cash register entries (open, close, record inflows/outflows)')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role."id", permission."id"
FROM "roles" role
JOIN "permissions" permission ON permission."code" IN ('cash_register.view', 'cash_register.manage')
WHERE role."name" = 'Reception'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
