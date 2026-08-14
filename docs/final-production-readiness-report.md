# Final production readiness report

## Executive summary

This repository has received a code-level hardening pass on 2026-08-14. It is
not signed off for production: material financial-control workflows and
integration coverage remain. See `remediation-matrix.md` for the authoritative
per-requirement state.

## Architecture and permission model

The workspace uses React/Vite, Express/Prisma/PostgreSQL, a shared validation
package and optional Electron client. The four system roles are Admin, Manager,
Reception and F&B. Backend permission middleware is authoritative; frontend
controls are presentation only. Guest-sensitive access is explicitly assigned
to Admin, Manager and Reception, not F&B.

## Verified workflows

Reservations check date overlap in serializable transactions. Check-in opens a
folio and checkout prevents a positive outstanding balance. Payments require
idempotency keys; refunds are immutable linked records with over-refund checks,
serializable transactions and audit entries. Direct F&B settlements and room
charges derive values from server-side catalog records. Inventory adjustments
are now transactional and append movement records; archived items preserve
historical evidence.

## Commands executed

| Command | Result | Status |
| --- | --- | --- |
| `npm.cmd run db:generate` | Prisma Client generated from the current schema. | PASS |
| `npm.cmd run lint` | Completed with 13 pre-existing warnings and no errors. | PASS |
| `npm.cmd run test` | Server Vitest: 4 files, 8 tests passed. | PASS |
| `npm.cmd run build:shared` | TypeScript build passed. | PASS |
| `npm.cmd run build:server` | Prisma generation and TypeScript build passed. | PASS |
| `npm.cmd run build:client` | TypeScript and Vite production build passed. | PASS |

## Production verification

Production was not accessed in this pass. No claim is made for live
authentication, migration state, database connectivity, backup/restore,
monitoring, or endpoint behavior.

# REMAINING ISSUES

| Severity | Description | Why it remains | Production blocker | Exact required action |
| --- | --- | --- | --- | --- |
| P0 | Daily close, cash reconciliation, and reconciled reporting are absent. | They require a reviewed financial domain and forward migration. | Yes | Implement immutable close/reconciliation records and mathematical integration tests. |
| P0 | Discounts/deposits are not a controlled, auditable payment workflow. | Current reservation fields do not establish authorization, reason, payment linkage, or reporting correctness. | Yes | Implement authorised backend commands, audit records, payment linkage and tests. |
| P0 | Inventory sales/waste/damage/transfer lifecycle is incomplete. | The opening/adjustment ledger is now safe, but operational movement types are not wired to POS/receiving. | Yes | Implement each movement source in a transaction and test rollback/concurrency. |
| P1 | Order and pool operational lifecycles are incomplete. | Orders currently settle immediately; pool lacks sessions/capacity policy. | Yes | Define operational states and implement server-authorised transitions. |
| P1 | RBAC, IDOR, concurrency and hotel lifecycle tests are incomplete. | Current unit suite covers validation/middleware only. | Yes | Add disposable-PostgreSQL API/integration tests and full workflows. |
| P1 | Live production, backup/restore and monitoring are unverified. | They require external approved access and must not be simulated. | Yes | Verify live health/migration/configuration and document provider retention, restoration and monitoring. |
