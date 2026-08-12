# NSVilla Management System

NSVilla is a production-oriented hospitality property management system for six operational portals:

- Admin
- Manager
- Reception
- Restaurant
- Bar
- Pool

## Architecture

- `packages/client` — React + TypeScript + Vite web workstation
- `packages/server` — Express + TypeScript API
- `packages/shared` — shared types, validation and permissions
- `packages/desktop` — Electron desktop shell
- `packages/server/prisma` — PostgreSQL schema, migrations and seed

The application is designed around real persistence:

`Client → API → PostgreSQL`

No production workflow depends on browser localStorage or fake operational records.

## Local setup

Requirements: Node.js 20+, npm, Docker Desktop.

1. Copy `.env.example` to `.env`.
2. Set unique JWT secrets and administrator credentials.
3. Start PostgreSQL:

```bash
docker compose up -d postgres
```

4. Install dependencies:

```bash
npm ci
```

5. Generate Prisma Client:

```bash
npm run db:generate
```

6. Create/apply the development schema:

```bash
npm run db:migrate
```

7. Seed only system configuration, permissions, roles and the explicitly configured initial administrator:

```bash
npm run db:seed
```

The seed intentionally does **not** create guests, reservations, stays, payments, orders, transactions, or other fake operational records.

8. Start the application:

```bash
npm run dev
```

- Web client: `http://localhost:5173`
- API: `http://localhost:3001`

## Production principles

- PostgreSQL is the authoritative database.
- Backend authorization is authoritative; frontend visibility is not security.
- Financial operations are transactional and auditable.
- Reservation availability is checked server-side.
- Important operations are recorded in the audit trail.
- Secrets are supplied through environment configuration.
- Production databases must never use the development seed credentials.
