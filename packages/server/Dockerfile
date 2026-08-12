# ============================================
# NS LUXURY VILLA — API + Client image
# Multi-stage build: shared → server → client,
# single runtime image serving both.
# ============================================

# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install all workspace deps (lockfile-driven)
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/client/package.json packages/client/package.json
COPY packages/desktop/package.json packages/desktop/package.json
RUN npm ci

# Build shared + server (shared build, prisma generate, tsc)
COPY packages/shared packages/shared
COPY packages/server packages/server
WORKDIR /app/packages/server
RUN npm run build

# Build the client bundle
COPY packages/client packages/client
WORKDIR /app/packages/client
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Node 20 runtime needs the Prisma query engine compatible with alpine (musl);
# the generated client is already musl-linked from the build stage.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/server/package.json ./packages/server/package.json
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/server/prisma ./packages/server/prisma
COPY --from=build /app/packages/client/dist ./packages/client/dist

WORKDIR /app/packages/server
EXPOSE 3001

# Apply migrations, then start the API (which also serves the built client).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
