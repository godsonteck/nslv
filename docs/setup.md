# NS Luxury Villa Management System — Development Setup Guide

## Prerequisites

- **Node.js**: >= v20.0.0 (v24.x recommended)
- **npm**: >= 10.x
- **Git**: Installed

---

## Installation & Initial Setup

1. **Clone the repository and install workspace dependencies**:
   ```bash
   npm install
   ```

2. **Setup environment variables**:
   ```bash
   cp .env.example .env
   cp .env packages/server/.env
   ```

3. **Initialize database schema & run seed script**:
   ```bash
   npx prisma generate --schema packages/server/prisma/schema.prisma
   npx prisma db push --schema packages/server/prisma/schema.prisma
   npx tsx packages/server/prisma/seed.ts
   ```

---

## Running Development Servers

- **Run Server & Client concurrently**:
  ```bash
  npm run dev
  ```
  - Backend API: `http://localhost:3001/api/v1`
  - Frontend App: `http://localhost:5173`

- **Run Desktop Electron App**:
  ```bash
  npm run dev:desktop
  ```

---

## Default Seed Credentials

- **Username**: `admin`
- **Email**: `admin@nsvilla.com`
- **Password**: `ChangeThisPassword123!`
