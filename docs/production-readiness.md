# NS Luxury Villa production readiness

Reviewed 2026-08-14 against the current repository.

## Verified

- The npm workspace builds shared, server, client, and desktop TypeScript successfully.
- Prisma Client generation succeeds.
- The Vercel CommonJS entrypoint successfully initializes Express and Prisma; local health returns HTTP 200 with database `AVAILABLE`.
- Live `https://nsluxury.vercel.app` returned HTTP 200 for the homepage and SPA fallback, served its JavaScript bundle as `application/javascript`, returned HTTP 200/database `AVAILABLE` for health, and returned HTTP 401 for unauthenticated guest data.
- The source defines and enforces the four official roles: Admin, Manager, Reception and F&B. F&B is not granted direct guest-profile permissions; Reception has sensitive guest access.
- Seed bootstrap no longer contains a fallback administrator identity/password and no longer resets an existing administrator password.

## Not production-ready

Do not sign off the system as production-ready. The unresolved P0/P1 controls are in [remediation-matrix.md](remediation-matrix.md): daily close/cash reconciliation, controlled discounts/deposits, inventory movement/concurrency proof, full F&B/pool lifecycles, report reconciliation, and database-backed RBAC/IDOR/concurrency/E2E tests.

## Deployment limitation

Live smoke checks were performed without privileged credentials. Live role assignments, authenticated portals, production migration state, backup/restore, provider monitoring, and financial workflows remain unverified and must not be inferred from the smoke results.
