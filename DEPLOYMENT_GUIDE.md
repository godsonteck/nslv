# 🚀 NSVilla Deployment Guide — Vercel + Neon PostgreSQL

Full-stack deployment:
- **Neon** → PostgreSQL database (hosted)
- **Vercel** → React frontend + Express API (serverless functions)

No separate backend server needed. The API runs as Vercel serverless functions.

---

## Step 1: Set Up Neon PostgreSQL Database

1. Go to [Neon.tech](https://neon.tech) and sign in / create a free account.
2. Click **Create Project** → name it `nsvilla`.
3. Under **Connection Details**, copy the **Pooled connection string** (with SSL):
   ```
   postgresql://nsvilla_owner:YOURPASSWORD@ep-XXXX.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

4. Run migrations and seed data from your local terminal against Neon:

   **Windows PowerShell:**
   ```powershell
   $env:DATABASE_URL="postgresql://nsvilla_owner:YOURPASSWORD@ep-XXXX.us-east-2.aws.neon.tech/neondb?sslmode=require"
   npm run db:migrate:prod
   npm run db:seed
   ```

   **macOS / Linux (bash):**
   ```bash
   export DATABASE_URL="postgresql://nsvilla_owner:YOURPASSWORD@..."
   npm run db:migrate:prod && npm run db:seed
   ```

---

## Step 2: Deploy to Vercel

### 2a. Import Project to Vercel

1. Log in to [Vercel.com](https://vercel.com).
2. Click **Add New** → **Project**.
3. Import your GitHub repository (`nslv`).
4. Leave all framework preset settings at **default** (Vercel auto-detects from `vercel.json`).
5. **Do NOT change** Root Directory, Build Command, or Output Directory — these come from `vercel.json`.

### 2b. Add Environment Variables

In Vercel Dashboard → Project → **Settings** → **Environment Variables**, add these **Production** variables:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Your Neon connection string from Step 1 |
| `JWT_ACCESS_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | Generate a **different** 64-char random hex string |
| `JWT_ACCESS_EXPIRY` | `15m` |
| `JWT_REFRESH_EXPIRY` | `7d` |
| `CLIENT_URL` | `https://YOUR_PROJECT.vercel.app` |
| `CORS_ORIGINS` | `https://YOUR_PROJECT.vercel.app,https://www.nsvilla.com` |
| `TRUST_PROXY` | `1` |
| `VILLA_NAME` | `NS Luxury Villa` |
| `VILLA_CURRENCY` | `GHS` |
| `VILLA_TIMEZONE` | `Africa/Accra` |
| `VILLA_COUNTRY` | `Ghana` |
| `VILLA_PHONE` | `+233 535 572 774` |
| `VILLA_EMAIL` | `nsvilla4u@gmail.com` |
| `VILLA_ADDRESS` | `VH-0102-0933, Torgbui Sapeh St, Ho, Ghana` |
| `VILLA_WEBSITE` | `https://www.nsvilla.com` |
| `ADMIN_DEFAULT_EMAIL` | `admin@nsvilla.com` |
| `ADMIN_DEFAULT_USERNAME` | `admin` |
| `ADMIN_DEFAULT_PASSWORD` | `Admin@NSVilla2026!` |

### 2c. Deploy

Click **Deploy**. Vercel will:
1. Run `npm ci --legacy-peer-deps`
2. Run `npm run build:shared && npm run build:client`
3. Output the static frontend to `packages/client/dist`
4. Register `api/index.ts` as a serverless function for `/api/*` routes

---

## Step 3: Connect Custom Domain (optional)

1. In Vercel Dashboard → Project → **Domains**.
2. Add `nsvilla.com` and follow the DNS setup instructions.

---

## Verification Checklist

- [ ] Neon database migrated and seeded (see Step 1).
- [ ] Vercel environment variables saved (see Step 2b).
- [ ] Vercel deployment succeeded (green build).
- [ ] API health check responds: `GET https://YOUR_PROJECT.vercel.app/api/v1/health` → `{"success":true}`
- [ ] Sign in at `https://YOUR_PROJECT.vercel.app/login` with admin credentials.
- [ ] Create a test reservation, guest, and POS order to confirm database writes work.
