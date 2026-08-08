# NS Luxury Villa Management System — Architecture Documentation

## Overview

The **NS Luxury Villa Management System** is a unified, production-ready hospitality management platform (PMS + POS + Operations Platform) built specifically for NS Luxury Villa in Ho, Volta Region, Ghana.

It supports both **Local Operation** (installed staff application on desktop computers at the villa) and **Remote Operation** (secure web dashboard for authorized administrators and managers).

---

## High-Level System Architecture

```text
                        NS LUXURY VILLA
                              |
        +---------------------+---------------------+
        |                                           |
 PUBLIC WEBSITE                               MANAGEMENT SYSTEM
 www.nsvilla.com                              manage.nsvilla.com
        |                                           |
        |                             +-------------+-------------+
        |                             |                           |
        |                       Desktop App                    Web Dashboard
        |                   (Staff @ Reception/Bar)       (Admin / Remote Manager)
        |                             |                           |
        +-----------------------------+---------------------------+
                                      |
                              SECURE BACKEND API
                           (Express.js + TypeScript)
                                      |
                        +-------------+-------------+
                        |                           |
                  CLOUD DATABASE               SYNC ENGINE
              (PostgreSQL Production)               |
                                              LOCAL DATABASE
                                            (SQLite Local Cache)
```

---

## Package Architecture (Monorepo)

The repository uses **npm workspaces** with 4 decoupled packages:

| Package | Path | Responsibilities |
|---------|------|------------------|
| `@nslv/shared` | `packages/shared` | Shared TypeScript types, Zod validation schemas, 60+ permission constants, status enums, currency helpers |
| `@nslv/server` | `packages/server` | Express REST API, Prisma ORM, Argon2id auth, JWT sessions, 2FA, RBAC middleware, Audit logger |
| `@nslv/client` | `packages/client` | React 18 + Vite frontend, NS Villa design system, Zustand state management, role-aware navigation |
| `@nslv/desktop` | `packages/desktop` | Electron desktop wrapper, electron-builder NSIS Windows installer config |

---

## Role-Based Access Control (RBAC)

Authorization is enforced strictly on the **server side** using granular permissions.

### Initial Roles & Core Access

1. **Admin**: Full system access (users, roles, permissions, settings, audit logs, financial backups).
2. **Manager**: Operational leadership (reservations, check-in/out, folios, payments, restaurant, bar, pool, inventory, reports).
3. **Reception**: Front desk operations (reservations, guests, rooms, check-in/out, room assignment, folios, payments).
4. **Restaurant**: Food ordering, kitchen status, menu management, room charges, daily food sales.
5. **Bar**: Drink ordering, bar inventory, room charges, daily beverage sales.
6. **Pool**: Pool entries, visitor passes, pool payments, incident reporting.

---

## Security Model

- **Password Hashing**: Argon2id with 64MB memory cost, 3 time iterations.
- **Tokens**: JWT access tokens (15m expiry) + refresh tokens with SHA-256 hash validation stored in DB sessions.
- **Two-Factor Auth**: TOTP 2FA (Google Authenticator / Authy compliant) for sensitive admin accounts.
- **HTTP Security**: Helmet headers, strict CORS origin whitelisting, rate limiting per IP.
- **Audit Trail**: Immutable audit logging of all logins, failed attempts, privilege changes, and financial modifications.
