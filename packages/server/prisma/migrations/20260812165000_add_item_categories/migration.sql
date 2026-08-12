-- CreateTable: ItemCategory
CREATE TABLE "item_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_categories_name_type_key" ON "item_categories"("name", "type");

-- CreateIndex
CREATE INDEX "item_categories_type_idx" ON "item_categories"("type");

-- CreateIndex
CREATE INDEX "item_categories_is_active_idx" ON "item_categories"("is_active");
