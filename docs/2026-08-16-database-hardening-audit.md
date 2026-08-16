# Engineering audit — 2026-08-16 (Database Hardening & Enforcement)

This audit documents the addition of database-level enforcement (PostgreSQL native ENUM types and CHECK constraints) as a defense-in-depth layer underneath existing application-layer validation.

## Verified and implemented in this pass

- **Audit & Schema Inspection**: Candidate columns and live table row counts were audited prior to migration generation. No unexpected values were found outside documented domain sets.
- **Postgres Native Enums**: Converted 20 status/type/method/condition/department fields across 17 models from plain `String` to native Postgres ENUMs (`UserStatus`, `RoomStatus`, `IdDocumentType`, `ReservationStatus`, `BookingSource`, `RoomCondition`, `PaymentMethod`, `PaymentStatus`, `PaymentType`, `FolioStatus`, `FolioItemType`, `Department`, `ItemCategoryType`, `OrderStatus`, `OrderPaymentStatus`, `ExpenseStatus`, `InventoryTransactionType`, `EventBookingStatus`, `NotificationType`, `NotificationPriority`).
- **User-Configurable Runtime Boundaries Preserved**: Runtime-configurable fields (`Expense.category`, `InventoryItem.category`, `RestaurantItem.category`, `BarItem.category`, `PoolService.category`, `InventoryItem.unit`) intentionally remain `String`, managed through dynamic `ItemCategory` configuration.
- **CHECK Constraints**: Added 37 numeric and date-ordering CHECK constraints across 13 tables using `NOT VALID` + `VALIDATE CONSTRAINT` to prevent long table locking on concurrent operations:
  - `payments`: `amount > 0`
  - `reservations`: `adults >= 1`, `children >= 0`, `base_rate >= 0`, `discount_amount >= 0`, `tax_amount >= 0`, `deposit_amount >= 0`, `total_amount >= 0`, `check_out_date > check_in_date`
  - `folio_items`: `quantity <> 0`, `amount <> 0`
  - `restaurant_orders`: `total_amount >= 0`
  - `restaurant_order_items`: `quantity > 0`, `unit_price >= 0`, `total_price >= 0`
  - `bar_orders`: `total_amount >= 0`
  - `bar_order_items`: `quantity > 0`, `unit_price >= 0`, `total_price >= 0`
  - `pool_transactions`: `quantity > 0`, `unit_price >= 0`, `total_amount >= 0`
  - `pool_attendance`: `party_size >= 1`
  - `expenses`: `amount > 0`
  - `inventory_items`: `quantity >= 0`, `min_quantity >= 0`, `cost_price IS NULL OR cost_price >= 0`
  - `inventory_movements`: `quantity_change <> 0`, `quantity_before >= 0`, `quantity_after >= 0`
  - `event_spaces`: `capacity >= 0`, `price_per_hour >= 0`
  - `event_bookings`: `guest_count >= 0`, `end_at >= start_at`
  - `room_types`: `base_price >= 0`, `max_adults >= 1`, `max_children >= 0`
- **Application Alignment**: Updated Prisma client generation, TypeScript DTOs, service query interfaces, and `@nslv/shared` enum definitions to strictly align with database types.

## Migration Details

- Directory: `packages/server/prisma/migrations/20260816103000_database_enums_and_check_constraints/`
- Migration file: `migration.sql`
- Production execution status: **PENDING REVIEW** (as instructed, `db:migrate:prod` was not executed against live production).

## Checks run

- Shared TypeScript build: passed (`tsc`).
- Server TypeScript build and Prisma client generation: passed (`prisma generate && tsc`).
- Client TypeScript & Vite production build: passed (`tsc && vite build`).
- Desktop package compilation: passed (`tsc`).
- Server Vitest test suite: passed (12 test suites, 37 tests passing).
- Vercel Serverless health check runtime simulation: passed (`health=200 database=AVAILABLE`).
- Database seed script: passed (`tsx prisma/seed.ts`).
