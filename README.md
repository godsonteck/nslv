# 🏨 NS Luxury Villa Management System

> Production hospitality management platform (PMS + POS + Operations Platform) for **NS Luxury Villa**, Ho, Ghana.  
> Tagline: *"Arrive as a guest, stay as family."*

---

## Architecture Summary

- **Frontend**: React 18, Vite, TypeScript, Custom Brand Design System, Zustand, React Router v7, TanStack Query.
- **Backend**: Express.js, TypeScript, Argon2id, JWT Auth, TOTP 2FA, Zod Validation, Audit Logging, Helmet, Rate Limiting.
- **Data Layer**: Prisma ORM, Cloud PostgreSQL (Production) / SQLite (Development Cache).
- **Desktop**: Electron wrapper with `electron-builder` NSIS installer support.

---

## Workspace Structure

```text
nslv/
├── packages/
│   ├── shared/     # @nslv/shared: Entity types, Zod schemas, 60+ permissions, enums, helpers
│   ├── server/     # @nslv/server: Express REST API, Prisma schema, Auth, RBAC, Audit logger
│   ├── client/     # @nslv/client: React + Vite frontend, NS Villa design system, Dashboard
│   └── desktop/    # @nslv/desktop: Electron main process, electron-builder NSIS config
├── docs/           # Architecture, Database, & Setup documentation
└── .env            # Environment configuration
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup database schema & seed initial admin
npx prisma db push --schema packages/server/prisma/schema.prisma
npx tsx packages/server/prisma/seed.ts

# 3. Start development server (API + Web app)
npm run dev
```

Default credentials:
- **Username**: `admin`
- **Password**: `ChangeThisPassword123!`

---

## Phase Status

- [x] **Phase 1 — Architecture & Foundation**: Complete
- [ ] **Phase 2 — Admin & System Configuration**: Next phase
