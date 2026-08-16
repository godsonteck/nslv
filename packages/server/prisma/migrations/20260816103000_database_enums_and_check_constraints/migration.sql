-- ============================================================
-- Migration: 20260816103000_database_enums_and_check_constraints
-- Adds Postgres ENUM types and CHECK constraints for defense-in-depth data integrity
-- ============================================================

-- ------------------------------------------------------------
-- 1. CREATE POSTGRES ENUM TYPES
-- ------------------------------------------------------------

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'DIRTY', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE');
CREATE TYPE "IdDocumentType" AS ENUM ('PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'VOTER_ID', 'GHANA_CARD', 'OTHER');
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "BookingSource" AS ENUM ('WALK_IN', 'PHONE', 'EMAIL', 'WEBSITE', 'WHATSAPP', 'OTA', 'REFERRAL', 'OTHER');
CREATE TYPE "RoomCondition" AS ENUM ('DIRTY', 'CLEAN', 'DAMAGED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'ROOM_CHARGE', 'OTHER');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE "PaymentType" AS ENUM ('PAYMENT', 'REFUND', 'DEPOSIT', 'ADJUSTMENT');
CREATE TYPE "FolioStatus" AS ENUM ('OPEN', 'CLOSED', 'DISPUTED');
CREATE TYPE "FolioItemType" AS ENUM ('ACCOMMODATION', 'RESTAURANT', 'BAR', 'POOL', 'SERVICE', 'DISCOUNT', 'TAX', 'PAYMENT', 'REFUND', 'ADJUSTMENT', 'DEPOSIT');
CREATE TYPE "Department" AS ENUM ('FRONT_DESK', 'RESTAURANT', 'BAR', 'POOL', 'HOUSEKEEPING', 'MAINTENANCE', 'MANAGEMENT', 'ADMINISTRATION');
CREATE TYPE "ItemCategoryType" AS ENUM ('RESTAURANT', 'BAR', 'POOL', 'INVENTORY', 'EXPENDITURE', 'ROOM_TYPE');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "OrderPaymentStatus" AS ENUM ('PENDING', 'PAID', 'CHARGED_TO_FOLIO', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');
CREATE TYPE "InventoryTransactionType" AS ENUM ('OPENING_BALANCE', 'STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN', 'WASTE');
CREATE TYPE "EventBookingStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "NotificationType" AS ENUM ('RESERVATION', 'PAYMENT', 'ALERT', 'SYSTEM', 'INFO');
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- ------------------------------------------------------------
-- 2. CONVERT COLUMNS TO ENUMS WITH SAFE DEFAULT HANDLING
-- ------------------------------------------------------------

-- users.status
ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "status" TYPE "UserStatus" USING "status"::text::"UserStatus";
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"UserStatus";

-- rooms.status
ALTER TABLE "rooms" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "rooms" ALTER COLUMN "status" TYPE "RoomStatus" USING "status"::text::"RoomStatus";
ALTER TABLE "rooms" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE'::"RoomStatus";

-- guests.id_document_type
ALTER TABLE "guests" ALTER COLUMN "id_document_type" TYPE "IdDocumentType" USING "id_document_type"::text::"IdDocumentType";

-- check_ins.id_document_type
ALTER TABLE "check_ins" ALTER COLUMN "id_document_type" TYPE "IdDocumentType" USING "id_document_type"::text::"IdDocumentType";

-- reservations.status & source
ALTER TABLE "reservations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "reservations" ALTER COLUMN "status" TYPE "ReservationStatus" USING "status"::text::"ReservationStatus";
ALTER TABLE "reservations" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ReservationStatus";

ALTER TABLE "reservations" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "reservations" ALTER COLUMN "source" TYPE "BookingSource" USING "source"::text::"BookingSource";
ALTER TABLE "reservations" ALTER COLUMN "source" SET DEFAULT 'WALK_IN'::"BookingSource";

-- check_outs.roomCondition & payment_method
ALTER TABLE "check_outs" ALTER COLUMN "roomCondition" DROP DEFAULT;
ALTER TABLE "check_outs" ALTER COLUMN "roomCondition" TYPE "RoomCondition" USING "roomCondition"::text::"RoomCondition";
ALTER TABLE "check_outs" ALTER COLUMN "roomCondition" SET DEFAULT 'DIRTY'::"RoomCondition";

ALTER TABLE "check_outs" ALTER COLUMN "payment_method" TYPE "PaymentMethod" USING "payment_method"::text::"PaymentMethod";

-- folios.status
ALTER TABLE "folios" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "folios" ALTER COLUMN "status" TYPE "FolioStatus" USING "status"::text::"FolioStatus";
ALTER TABLE "folios" ALTER COLUMN "status" SET DEFAULT 'OPEN'::"FolioStatus";

-- folio_items.type & department
ALTER TABLE "folio_items" ALTER COLUMN "type" TYPE "FolioItemType" USING "type"::text::"FolioItemType";
ALTER TABLE "folio_items" ALTER COLUMN "department" TYPE "Department" USING "department"::text::"Department";

-- payments.method, status, type
ALTER TABLE "payments" ALTER COLUMN "method" TYPE "PaymentMethod" USING "method"::text::"PaymentMethod";

ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "payments" ALTER COLUMN "status" TYPE "PaymentStatus" USING "status"::text::"PaymentStatus";
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'COMPLETED'::"PaymentStatus";

ALTER TABLE "payments" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "payments" ALTER COLUMN "type" TYPE "PaymentType" USING "type"::text::"PaymentType";
ALTER TABLE "payments" ALTER COLUMN "type" SET DEFAULT 'PAYMENT'::"PaymentType";

-- item_categories.type
ALTER TABLE "item_categories" ALTER COLUMN "type" TYPE "ItemCategoryType" USING "type"::text::"ItemCategoryType";

-- restaurant_orders.status, paymentMethod, paymentStatus
ALTER TABLE "restaurant_orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "restaurant_orders" ALTER COLUMN "status" TYPE "OrderStatus" USING "status"::text::"OrderStatus";
ALTER TABLE "restaurant_orders" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"OrderStatus";

ALTER TABLE "restaurant_orders" ALTER COLUMN "paymentMethod" DROP DEFAULT;
ALTER TABLE "restaurant_orders" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" USING "paymentMethod"::text::"PaymentMethod";
ALTER TABLE "restaurant_orders" ALTER COLUMN "paymentMethod" SET DEFAULT 'ROOM_CHARGE'::"PaymentMethod";

ALTER TABLE "restaurant_orders" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "restaurant_orders" ALTER COLUMN "paymentStatus" TYPE "OrderPaymentStatus" USING "paymentStatus"::text::"OrderPaymentStatus";
ALTER TABLE "restaurant_orders" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING'::"OrderPaymentStatus";

-- bar_orders.status, paymentMethod, paymentStatus
ALTER TABLE "bar_orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bar_orders" ALTER COLUMN "status" TYPE "OrderStatus" USING "status"::text::"OrderStatus";
ALTER TABLE "bar_orders" ALTER COLUMN "status" SET DEFAULT 'COMPLETED'::"OrderStatus";

ALTER TABLE "bar_orders" ALTER COLUMN "paymentMethod" DROP DEFAULT;
ALTER TABLE "bar_orders" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" USING "paymentMethod"::text::"PaymentMethod";
ALTER TABLE "bar_orders" ALTER COLUMN "paymentMethod" SET DEFAULT 'ROOM_CHARGE'::"PaymentMethod";

ALTER TABLE "bar_orders" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "bar_orders" ALTER COLUMN "paymentStatus" TYPE "OrderPaymentStatus" USING "paymentStatus"::text::"OrderPaymentStatus";
ALTER TABLE "bar_orders" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING'::"OrderPaymentStatus";

-- pool_transactions.paymentMethod, paymentStatus
ALTER TABLE "pool_transactions" ALTER COLUMN "paymentMethod" DROP DEFAULT;
ALTER TABLE "pool_transactions" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" USING "paymentMethod"::text::"PaymentMethod";
ALTER TABLE "pool_transactions" ALTER COLUMN "paymentMethod" SET DEFAULT 'ROOM_CHARGE'::"PaymentMethod";

ALTER TABLE "pool_transactions" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "pool_transactions" ALTER COLUMN "paymentStatus" TYPE "OrderPaymentStatus" USING "paymentStatus"::text::"OrderPaymentStatus";
ALTER TABLE "pool_transactions" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING'::"OrderPaymentStatus";

-- expenses.payment_method, status
ALTER TABLE "expenses" ALTER COLUMN "payment_method" TYPE "PaymentMethod" USING "payment_method"::text::"PaymentMethod";

ALTER TABLE "expenses" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "expenses" ALTER COLUMN "status" TYPE "ExpenseStatus" USING "status"::text::"ExpenseStatus";
ALTER TABLE "expenses" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ExpenseStatus";

-- inventory_movements.type
ALTER TABLE "inventory_movements" ALTER COLUMN "type" TYPE "InventoryTransactionType" USING "type"::text::"InventoryTransactionType";

-- event_bookings.status
ALTER TABLE "event_bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "event_bookings" ALTER COLUMN "status" TYPE "EventBookingStatus" USING "status"::text::"EventBookingStatus";
ALTER TABLE "event_bookings" ALTER COLUMN "status" SET DEFAULT 'CONFIRMED'::"EventBookingStatus";

-- notifications.type, priority
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType" USING "type"::text::"NotificationType";

ALTER TABLE "notifications" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "notifications" ALTER COLUMN "priority" TYPE "NotificationPriority" USING "priority"::text::"NotificationPriority";
ALTER TABLE "notifications" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM'::"NotificationPriority";

-- ------------------------------------------------------------
-- 3. ADD NUMERIC & INVARIANT CHECK CONSTRAINTS (NOT VALID + VALIDATE)
-- ------------------------------------------------------------

-- payments
ALTER TABLE "payments" ADD CONSTRAINT "payments_positive_amount" CHECK ("amount" > 0) NOT VALID;
ALTER TABLE "payments" VALIDATE CONSTRAINT "payments_positive_amount";

-- reservations
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_positive_adults" CHECK ("adults" >= 1) NOT VALID;
ALTER TABLE "reservations" VALIDATE CONSTRAINT "reservations_positive_adults";

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_non_negative_children" CHECK ("children" >= 0) NOT VALID;
ALTER TABLE "reservations" VALIDATE CONSTRAINT "reservations_non_negative_children";

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_non_negative_base_rate" CHECK ("base_rate" >= 0) NOT VALID;
ALTER TABLE "reservations" VALIDATE CONSTRAINT "reservations_non_negative_base_rate";

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_non_negative_discount" CHECK ("discount_amount" >= 0) NOT VALID;
ALTER TABLE "reservations" VALIDATE CONSTRAINT "reservations_non_negative_discount";

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_non_negative_tax" CHECK ("tax_amount" >= 0) NOT VALID;
ALTER TABLE "reservations" VALIDATE CONSTRAINT "reservations_non_negative_tax";

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_non_negative_deposit" CHECK ("deposit_amount" >= 0) NOT VALID;
ALTER TABLE "reservations" VALIDATE CONSTRAINT "reservations_non_negative_deposit";

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_non_negative_total" CHECK ("total_amount" >= 0) NOT VALID;
ALTER TABLE "reservations" VALIDATE CONSTRAINT "reservations_non_negative_total";

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_checkout_after_checkin" CHECK ("check_out_date" > "check_in_date") NOT VALID;
ALTER TABLE "reservations" VALIDATE CONSTRAINT "reservations_checkout_after_checkin";

-- folio_items
ALTER TABLE "folio_items" ADD CONSTRAINT "folio_items_non_zero_quantity" CHECK ("quantity" <> 0) NOT VALID;
ALTER TABLE "folio_items" VALIDATE CONSTRAINT "folio_items_non_zero_quantity";

ALTER TABLE "folio_items" ADD CONSTRAINT "folio_items_non_zero_amount" CHECK ("amount" <> 0) NOT VALID;
ALTER TABLE "folio_items" VALIDATE CONSTRAINT "folio_items_non_zero_amount";

-- restaurant_orders
ALTER TABLE "restaurant_orders" ADD CONSTRAINT "restaurant_orders_non_negative_total" CHECK ("total_amount" >= 0) NOT VALID;
ALTER TABLE "restaurant_orders" VALIDATE CONSTRAINT "restaurant_orders_non_negative_total";

-- restaurant_order_items
ALTER TABLE "restaurant_order_items" ADD CONSTRAINT "restaurant_order_items_positive_quantity" CHECK ("quantity" > 0) NOT VALID;
ALTER TABLE "restaurant_order_items" VALIDATE CONSTRAINT "restaurant_order_items_positive_quantity";

ALTER TABLE "restaurant_order_items" ADD CONSTRAINT "restaurant_order_items_non_negative_unit_price" CHECK ("unit_price" >= 0) NOT VALID;
ALTER TABLE "restaurant_order_items" VALIDATE CONSTRAINT "restaurant_order_items_non_negative_unit_price";

ALTER TABLE "restaurant_order_items" ADD CONSTRAINT "restaurant_order_items_non_negative_total_price" CHECK ("total_price" >= 0) NOT VALID;
ALTER TABLE "restaurant_order_items" VALIDATE CONSTRAINT "restaurant_order_items_non_negative_total_price";

-- bar_orders
ALTER TABLE "bar_orders" ADD CONSTRAINT "bar_orders_non_negative_total" CHECK ("total_amount" >= 0) NOT VALID;
ALTER TABLE "bar_orders" VALIDATE CONSTRAINT "bar_orders_non_negative_total";

-- bar_order_items
ALTER TABLE "bar_order_items" ADD CONSTRAINT "bar_order_items_positive_quantity" CHECK ("quantity" > 0) NOT VALID;
ALTER TABLE "bar_order_items" VALIDATE CONSTRAINT "bar_order_items_positive_quantity";

ALTER TABLE "bar_order_items" ADD CONSTRAINT "bar_order_items_non_negative_unit_price" CHECK ("unit_price" >= 0) NOT VALID;
ALTER TABLE "bar_order_items" VALIDATE CONSTRAINT "bar_order_items_non_negative_unit_price";

ALTER TABLE "bar_order_items" ADD CONSTRAINT "bar_order_items_non_negative_total_price" CHECK ("total_price" >= 0) NOT VALID;
ALTER TABLE "bar_order_items" VALIDATE CONSTRAINT "bar_order_items_non_negative_total_price";

-- pool_transactions
ALTER TABLE "pool_transactions" ADD CONSTRAINT "pool_transactions_positive_quantity" CHECK ("quantity" > 0) NOT VALID;
ALTER TABLE "pool_transactions" VALIDATE CONSTRAINT "pool_transactions_positive_quantity";

ALTER TABLE "pool_transactions" ADD CONSTRAINT "pool_transactions_non_negative_unit_price" CHECK ("unit_price" >= 0) NOT VALID;
ALTER TABLE "pool_transactions" VALIDATE CONSTRAINT "pool_transactions_non_negative_unit_price";

ALTER TABLE "pool_transactions" ADD CONSTRAINT "pool_transactions_non_negative_total" CHECK ("total_amount" >= 0) NOT VALID;
ALTER TABLE "pool_transactions" VALIDATE CONSTRAINT "pool_transactions_non_negative_total";

-- pool_attendance
ALTER TABLE "pool_attendance" ADD CONSTRAINT "pool_attendance_positive_party_size" CHECK ("party_size" >= 1) NOT VALID;
ALTER TABLE "pool_attendance" VALIDATE CONSTRAINT "pool_attendance_positive_party_size";

-- expenses
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_positive_amount" CHECK ("amount" > 0) NOT VALID;
ALTER TABLE "expenses" VALIDATE CONSTRAINT "expenses_positive_amount";

-- inventory_items
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_non_negative_quantity" CHECK ("quantity" >= 0) NOT VALID;
ALTER TABLE "inventory_items" VALIDATE CONSTRAINT "inventory_items_non_negative_quantity";

ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_non_negative_min_quantity" CHECK ("min_quantity" >= 0) NOT VALID;
ALTER TABLE "inventory_items" VALIDATE CONSTRAINT "inventory_items_non_negative_min_quantity";

ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_non_negative_cost_price" CHECK ("cost_price" IS NULL OR "cost_price" >= 0) NOT VALID;
ALTER TABLE "inventory_items" VALIDATE CONSTRAINT "inventory_items_non_negative_cost_price";

-- inventory_movements
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_non_zero_change" CHECK ("quantity_change" <> 0) NOT VALID;
ALTER TABLE "inventory_movements" VALIDATE CONSTRAINT "inventory_movements_non_zero_change";

ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_non_negative_before" CHECK ("quantity_before" >= 0) NOT VALID;
ALTER TABLE "inventory_movements" VALIDATE CONSTRAINT "inventory_movements_non_negative_before";

ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_non_negative_after" CHECK ("quantity_after" >= 0) NOT VALID;
ALTER TABLE "inventory_movements" VALIDATE CONSTRAINT "inventory_movements_non_negative_after";

-- event_spaces
ALTER TABLE "event_spaces" ADD CONSTRAINT "event_spaces_non_negative_capacity" CHECK ("capacity" >= 0) NOT VALID;
ALTER TABLE "event_spaces" VALIDATE CONSTRAINT "event_spaces_non_negative_capacity";

ALTER TABLE "event_spaces" ADD CONSTRAINT "event_spaces_non_negative_price" CHECK ("price_per_hour" >= 0) NOT VALID;
ALTER TABLE "event_spaces" VALIDATE CONSTRAINT "event_spaces_non_negative_price";

-- event_bookings
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_non_negative_guests" CHECK ("guest_count" >= 0) NOT VALID;
ALTER TABLE "event_bookings" VALIDATE CONSTRAINT "event_bookings_non_negative_guests";

ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_end_after_start" CHECK ("end_at" >= "start_at") NOT VALID;
ALTER TABLE "event_bookings" VALIDATE CONSTRAINT "event_bookings_end_after_start";

-- room_types
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_non_negative_price" CHECK ("base_price" >= 0) NOT VALID;
ALTER TABLE "room_types" VALIDATE CONSTRAINT "room_types_non_negative_price";

ALTER TABLE "room_types" ADD CONSTRAINT "room_types_positive_max_adults" CHECK ("max_adults" >= 1) NOT VALID;
ALTER TABLE "room_types" VALIDATE CONSTRAINT "room_types_positive_max_adults";

ALTER TABLE "room_types" ADD CONSTRAINT "room_types_non_negative_max_children" CHECK ("max_children" >= 0) NOT VALID;
ALTER TABLE "room_types" VALIDATE CONSTRAINT "room_types_non_negative_max_children";
