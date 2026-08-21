-- AlterTable
ALTER TABLE "cash_register_entries" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "cash_registers" ALTER COLUMN "opening_cash" SET DATA TYPE DECIMAL(65,30);
