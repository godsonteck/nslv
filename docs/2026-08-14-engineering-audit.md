# Engineering audit — 2026-08-14

This is an implementation-based audit of the tracked workspace monorepo. It is
not a production-readiness declaration.

## Verified and corrected in this pass

- The shared role contract is `Admin`, `Manager`, `Reception`, and `F&B`.
- The seed process consolidates the legacy `Restaurant`, `Bar`, and `Pool`
  assignments into `F&B`; migration `20260814000000_consolidate_four_roles`
  performs the same preservation for deployed databases.
- New and edited users are now restricted to the four official system roles.
  The role screen and API no longer allow custom role creation, deletion, or
  renaming; administrators can configure permission assignments only.
- Reception now receives `guests.view_sensitive`, matching the requirement to
  view complete guest profiles. F&B has no direct guest-profile permission.
- Protected routers call `authenticate` and `verifyActiveUser`. The latter now
  reloads roles and permissions from PostgreSQL on every protected request, so
  a database role/permission change is not deferred until access-token expiry.
- Logout now authenticates and validates the supplied refresh token. Authenticated
  profile, password, and 2FA routes now reject inactive accounts.
- Reservation creation excludes maintenance and out-of-service rooms. Cancellation
  no longer blindly marks a room available. Generic status updates cannot set
  `RESERVED` or `OCCUPIED`; those belong to reservation/stay workflows.
- Check-in now validates a confirmed/pending reservation, stay dates, and room
  availability before its existing transaction creates check-in, folio, and
  occupied-room records.

## Confirmed gaps requiring subsequent phases

- Restaurant and bar orders are immediately written as `COMPLETED`; the requested
  new-to-served workflow is not implemented.
- Pool attendance exists, but pool sessions, capacity, visitor child/adult counts,
  packages, and an end-to-end payment/receipt workflow are incomplete.
- There is no complete refund, controlled discount, daily-close, cash-reconciliation,
  or full financial-report model/workflow.
- Guest records do not currently model gender, emergency contact, or a separate
  passport field. Do not add those fields without a reviewed migration and UI/API
  flow.
- API integration/RBAC coverage is currently minimal (two middleware tests). A
  lifecycle E2E suite and direct unauthorized-endpoint tests are still required.
- `npm run lint` is not runnable because `eslint` is absent from the installed
  dependencies despite the root lint script referencing it.
- Browser/runtime verification, production migration deployment, backup/restore,
  monitoring, and live Vercel health checks were not performed in this pass.

## Checks run

- Shared TypeScript build: passed.
- Server TypeScript build and Prisma client generation: passed.
- Client TypeScript/Vite production build: passed.
- Server Vitest suite: passed (2 tests).
- Root lint: blocked by missing `eslint` executable.
