-- DropIndex
DROP INDEX IF EXISTS "inventory_movements_reference_id_recipe_item_id_key";

-- AlterTable
ALTER TABLE "inventory_movements" DROP COLUMN IF EXISTS "recipe_item_id";

-- DropTable
DROP TABLE IF EXISTS "recipe_items";

-- DropTable
DROP TABLE IF EXISTS "recipes";