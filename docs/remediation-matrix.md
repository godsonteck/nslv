# Production remediation matrix

Current-state review performed 2026-08-14. This is evidence-based: passing
builds do not close the items marked incomplete.

| Area | Current result | Severity | Evidence / next action |
| --- | --- | --- | --- |
| Vercel entrypoint | Pass | — | `npm run test:vercel-runtime` loads `api/index.js`, calls health, and reports database AVAILABLE. |
| Live deployment | Pass for smoke checks | — | Homepage, SPA fallback, JavaScript MIME type, health, and unauthenticated guest 401 verified at `nsluxury.vercel.app`. |
| Initial admin seed | Fixed | P0 resolved | Seed no longer supplies predictable credentials or overwrites an existing administrator password. Explicit bootstrap values are required only when creating the first account. |
| Four official roles | Code enforced | P1 live verification pending | Constants and role service restrict creation/renaming to Admin, Manager, Reception, and F&B. Verify actual production role records after an approved deployment. |
| Guest privacy | Code enforced | P1 test gap | Admin, Manager and Reception have `guests.view_sensitive`; F&B lacks guest-profile permissions. Add database-backed endpoint tests. |
| Reservation concurrency | Implementation present | P1 test gap | Serializable availability transaction exists; add a real concurrent PostgreSQL test. |
| Payments/refunds | Partial | P1 | Payment/refund validation and basic idempotency tests pass, but concurrent payment, post-checkout correction, and full lifecycle coverage are absent. |
| Discounts/deposits | Incomplete | P0 | Reservation fields are not a complete permission-controlled, audited financial workflow. |
| Restaurant, bar, pool | Partial | P1 | Server derives prices and records settlement; complete operational state lifecycles and pool session/capacity policy are absent. |
| Inventory | Partial | P0 | Further movement types and concurrent stock-deduction proof remain required. |
| Daily close/reconciliation | Missing | P0 | No complete immutable daily-close and cash-variance workflow was verified. |
| Reports/audit | Partial | P1 | Audit service is used by core operations, but financial report reconciliation needs integration evidence. |
| Security/RBAC testing | Partial | P0 | JWT, rate limiting, Helmet, CORS, active-user rehydration and middleware exist; endpoint-level 401/403/IDOR test matrix is missing. |

The P0/P1 items above block a production-ready sign-off.
