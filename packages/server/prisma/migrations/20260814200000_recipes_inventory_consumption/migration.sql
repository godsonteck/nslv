CREATE TABLE "recipes" (
  "id" TEXT NOT NULL,
  "restaurant_item_id" TEXT,
  "bar_item_id" TEXT,
  "pool_service_id" TEXT,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recipes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recipes_restaurant_item_id_fkey" FOREIGN KEY ("restaurant_item_id") REFERENCES "restaurant_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "recipes_bar_item_id_fkey" FOREIGN KEY ("bar_item_id") REFERENCES "bar_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "recipes_pool_service_id_fkey" FOREIGN KEY ("pool_service_id") REFERENCES "pool_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "recipes_exactly_one_sellable" CHECK (("restaurant_item_id" IS NOT NULL)::int + ("bar_item_id" IS NOT NULL)::int + ("pool_service_id" IS NOT NULL)::int = 1)
);

CREATE TABLE "recipe_items" (
  "id" TEXT NOT NULL,
  "recipe_id" TEXT NOT NULL,
  "inventory_item_id" TEXT NOT NULL,
  "quantity" DECIMAL(65,30) NOT NULL,
  "unit" TEXT NOT NULL,
  "conversion_factor" DECIMAL(65,30) NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recipe_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recipe_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "recipe_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "recipe_items_recipe_id_inventory_item_id_key" UNIQUE ("recipe_id", "inventory_item_id"),
  CONSTRAINT "recipe_items_positive_quantity" CHECK ("quantity" > 0 AND "conversion_factor" > 0)
);

CREATE INDEX "recipes_restaurant_item_id_is_active_idx" ON "recipes"("restaurant_item_id", "is_active");
CREATE INDEX "recipes_bar_item_id_is_active_idx" ON "recipes"("bar_item_id", "is_active");
CREATE INDEX "recipes_pool_service_id_is_active_idx" ON "recipes"("pool_service_id", "is_active");

ALTER TABLE "inventory_movements" ADD COLUMN "reference_id" TEXT;
ALTER TABLE "inventory_movements" ADD COLUMN "reference_type" TEXT;
ALTER TABLE "inventory_movements" ADD COLUMN "recipe_item_id" TEXT;
CREATE UNIQUE INDEX "inventory_movements_reference_id_recipe_item_id_key" ON "inventory_movements"("reference_id", "recipe_item_id");
