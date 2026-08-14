-- Refunds are append-only payment records linked to their original payment.
ALTER TABLE "payments" ADD COLUMN "original_payment_id" TEXT;

CREATE INDEX "payments_original_payment_id_idx" ON "payments"("original_payment_id");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_original_payment_id_fkey"
  FOREIGN KEY ("original_payment_id") REFERENCES "payments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
