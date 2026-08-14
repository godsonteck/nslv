# NS Luxury Villa production readiness

Last code review: 2026-08-14.

## Vercel recovery

The Vercel function failure was reproduced locally before repair. `api/index.js`
uses CommonJS `require`, while `packages/server/tsconfig.json` previously emitted
ES module syntax and extensionless directory imports. Node therefore failed when
loading the Vercel entrypoint with `ERR_UNSUPPORTED_DIR_IMPORT` for
`packages/server/dist/config`. The server compiler now emits CommonJS with Node
module resolution, matching the function entrypoint. `npm run test:vercel-runtime`
loads that exact entrypoint and calls `/api/v1/health` without starting the
standalone listener.

## Architecture

The application is an npm workspace: React/Vite client, Express/Prisma API,
shared validation and type contract, and an optional Electron desktop shell.
Production is configured as a Vercel static frontend with an `/api` serverless
handler and PostgreSQL/Neon-compatible Prisma datasource.

## Current controls verified in code

- Four system roles: Admin, Manager, Reception and F&B. Current role and
  permission assignments are reloaded from PostgreSQL on protected requests.
- F&B is not granted direct guest-profile permissions. Admin, Manager and
  Reception can be granted the sensitive guest view permission.
- Reservations use serializable availability transactions; check-in creates an
  open folio, and checkout refuses a positive balance.
- Payments and refunds are persisted with Prisma Decimal values, linked refunds,
  idempotency keys, serializable refund handling, and transactional audit logs.
- Restaurant, bar, pool service settlement, and room charges calculate menu or
  service values on the server rather than accepting a browser total.
- Inventory now retains an append-only movement ledger for opening balances and
  adjustments; deleting an item archives it instead of removing history.
- Helmet, CORS allow-listing, rate limiting, error sanitisation, JWT validation,
  and active-account checks are configured in the API.

## Production blockers

The current codebase must **not** be described as production-ready yet. The
following P0/P1 items in `remediation-matrix.md` require implementation and
test evidence: controlled discounts and deposits, post-checkout correction and
refund policy, F&B operational order lifecycle, full pool session workflow,
daily close/cash reconciliation, report reconciliation, and database-backed
RBAC/concurrency/lifecycle test coverage.

## Deployment, backups, and monitoring

The repository contains Vercel configuration and a database-aware health
endpoint. Production migration state, health, authentication, monitoring,
backup schedule, retention, restore procedure and restore drill have not been
verified in this workspace. Those require approved production/database access;
do not run destructive migration commands or test restores against production.

## CI

`.github/workflows/ci.yml` installs dependencies, generates Prisma, lints,
tests, builds shared/server/client packages, and compiles the desktop shell.
It intentionally does not run database migrations or resets.

## Verification limitation

After a clean `npm ci`, the managed local sandbox denied esbuild access while it
traversed parent directories to load Vite and Vitest configuration files. This
is an execution-environment restriction, not a source loading error: the same
build and test commands passed before that restriction was applied, and the
Vercel entrypoint smoke test still passed after the clean installation. CI must
run the commands in its normal GitHub-hosted filesystem before release.
