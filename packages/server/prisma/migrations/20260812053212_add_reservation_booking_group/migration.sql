-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "booking_id" TEXT;

-- CreateIndex
CREATE INDEX "reservations_booking_id_idx" ON "reservations"("booking_id");
