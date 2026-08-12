# NSVilla implementation status

This repository is now organized as a real-data application foundation.

## Completed in this build

- Removed the duplicate legacy root Vite application from the workspace.
- Standardized the active application under `packages/client`, `packages/server`, `packages/shared`, and `packages/desktop`.
- Switched Prisma's authoritative datasource to PostgreSQL.
- Made a reservation's folio unique to the reservation.
- Hardened reservation creation so room pricing is authoritative on the server.
- Added serializable transaction isolation to reservation creation to reduce double-booking races.
- Reworked POS totals so item/service prices come from the database instead of client-submitted prices.
- Added validation for POS quantities and amounts.
- Added real server-side permission checks to core guest, room, reservation, stay, folio, payment, report and POS routes.
- Hardened payment processing against invalid amounts and overpayment.
- Removed operational mock records from the seed process.
- Made the initial administrator credentials explicitly environment-driven.
- Added a local PostgreSQL Docker Compose service.
- Redesigned the application shell and main dashboard around live API data and intentional empty states.
- Added responsive mobile navigation.
- Removed UI controls that did not have real behavior.

## Fresh-install behavior

A new database is intentionally empty of guests, reservations, stays, payments and department transactions. The seed creates only system permissions, roles, settings and the explicitly configured initial administrator.

Room types, rooms and department catalogs should be configured through the application before operational use.

## Validation note

The server and shared TypeScript projects compiled successfully before the dependency directories were removed from this deliverable. A final clean-machine validation should be run with `npm ci`, `npm run db:generate`, `npm run build`, and the configured PostgreSQL instance before deployment.
