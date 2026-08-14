CREATE TABLE "daily_closes" (
  "id" TEXT NOT NULL,
  "business_date" TIMESTAMP(3) NOT NULL,
  "opening_cash" DECIMAL(65,30) NOT NULL,
  "cash_payments" DECIMAL(65,30) NOT NULL,
  "cash_refunds" DECIMAL(65,30) NOT NULL,
  "cash_expenses" DECIMAL(65,30) NOT NULL,
  "expected_cash" DECIMAL(65,30) NOT NULL,
  "actual_cash" DECIMAL(65,30) NOT NULL,
  "variance" DECIMAL(65,30) NOT NULL,
  "variance_note" TEXT,
  "closed_by" TEXT NOT NULL,
  "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_closes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "daily_closes_business_date_key" ON "daily_closes"("business_date");
