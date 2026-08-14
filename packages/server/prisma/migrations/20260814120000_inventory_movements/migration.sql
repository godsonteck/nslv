-- Inventory movements are immutable ledger records. Existing quantities are
-- retained as the opening balance; only future changes are ledgered here.
CREATE TABLE "inventory_movements" (
  "id" TEXT NOT NULL,
  "inventory_item_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "quantity_change" INTEGER NOT NULL,
  "quantity_before" INTEGER NOT NULL,
  "quantity_after" INTEGER NOT NULL,
  "reason" TEXT,
  "recorded_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_inventory_item_id_fkey"
  FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "inventory_movements_inventory_item_id_created_at_idx"
  ON "inventory_movements"("inventory_item_id", "created_at");
CREATE INDEX "inventory_movements_type_created_at_idx"
  ON "inventory_movements"("type", "created_at");
