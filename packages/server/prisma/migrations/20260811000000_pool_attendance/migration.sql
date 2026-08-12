CREATE TABLE "pool_attendance" (
    "id" TEXT NOT NULL,
    "visitor_name" TEXT NOT NULL,
    "phone" TEXT,
    "party_size" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "recorded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pool_attendance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pool_attendance_created_at_idx" ON "pool_attendance"("created_at");
