# 🚀 NSVilla Online Deployment Guide (Vercel + Neon + Render/Railway)

This guide walks you through deploying the **NSVilla Management System** using:
1. **Neon PostgreSQL** — Database hosting
2. **Render / Railway** — Backend Express API hosting (Node + Prisma)
3. **Vercel** — Frontend React + Vite Web Client hosting

---

## Step 1: Set Up Neon PostgreSQL Database

1. Go to [Neon.tech](https://neon.tech) and create an account or sign in.
2. Click **Create Project** (Name: `nsvilla-db`).
3. Copy your **Pooled Connection String** or **Direct Connection String** with SSL mode enabled. It looks like:
   ```text
   postgresql://nslv_owner:xxxxxxxxxxxx@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Run migrations & seed data from your local terminal against your Neon database:

   **On Windows PowerShell:**
   ```powershell
   $env:DATABASE_URL="postgresql://nslv_owner:xxxxxxxxxxxx@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
   npm run db:migrate:prod
   npm run db:seed
   ```

   **On Linux/macOS:**
   ```bash
   DATABASE_URL="postgresql://nslv_owner:xxxxxxxxxxxx@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require" npm run db:migrate:prod
   DATABASE_URL="postgresql://nslv_owner:xxxxxxxxxxxx@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require" npm run db:seed
   ```

---

## Step 2: Deploy Backend API Server (Render or Railway)

### Option A: Deploy on Render.com (Recommended)

1. Sign up/Log in at [Render.com](https://render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository (`nslv`).
4. Set the runtime configuration:
   - **Language**: `Docker` (or Node)
   - **Dockerfile Path**: `packages/server/Dockerfile`
   - **Docker Context**: `.`
5. Under **Environment Variables**, add:
   | Key | Example / Description |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | Your Neon connection string (from Step 1) |
   | `JWT_ACCESS_SECRET` | Generate a long random secret string |
   | `JWT_REFRESH_SECRET` | Generate a long random secret string |
   | `CLIENT_URL` | `https://your-app.vercel.app` (Your Vercel URL from Step 3) |
   | `CORS_ORIGINS` | `https://your-app.vercel.app` |
   | `TRUST_PROXY` | `1` |
   | `VILLA_NAME` | `NS Luxury Villa` |
   | `VILLA_CURRENCY` | `GHS` |
   | `VILLA_TIMEZONE` | `Africa/Accra` |
6. Click **Deploy Web Service**.
7. Copy your live backend API URL once deployed (e.g. `https://nsvilla-api.onrender.com`).

---

## Step 3: Deploy Frontend Client on Vercel

1. Log in to [Vercel.com](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Import your GitHub repository (`nslv`).
4. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `packages/client`
   - **Build Command**: `cd ../.. && npm run build:shared && cd packages/client && npm run build`
   - **Output Directory**: `dist`
5. Environment Variables on Vercel:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | Your live backend URL from Step 2 (e.g. `https://nsvilla-api.onrender.com`) |
6. Click **Deploy**.

---

## Verification Checklist

- [ ] Database migrated & seeded on Neon.
- [ ] Backend API responding at `https://nsvilla-api.onrender.com/api/v1/health` with `{"status":"ok"}`.
- [ ] Frontend accessible at `https://your-app.vercel.app`.
- [ ] Test signing in with configured administrator credentials.
