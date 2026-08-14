-- Link direct F&B settlements to the central payments ledger and make create
-- operations retry-safe. Nullable keys keep historical records valid.
ALTER TABLE "payments"
  ADD COLUMN "source" TEXT,
  ADD COLUMN "source_id" TEXT,
  ADD COLUMN "idempotency_key" TEXT;

ALTER TABLE "restaurant_orders" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "bar_orders" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "pool_transactions" ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");
CREATE UNIQUE INDEX "restaurant_orders_idempotency_key_key" ON "restaurant_orders"("idempotency_key");
CREATE UNIQUE INDEX "bar_orders_idempotency_key_key" ON "bar_orders"("idempotency_key");
CREATE UNIQUE INDEX "pool_transactions_idempotency_key_key" ON "pool_transactions"("idempotency_key");
CREATE INDEX "payments_source_source_id_idx" ON "payments"("source", "source_id");
