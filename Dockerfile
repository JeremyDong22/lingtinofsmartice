# Dockerfile for Lingtin Web (Next.js) - v1.0
# Frontend deployment on Zeabur (Node.js server mode)
# Build from monorepo root, serves Next.js with SSR

FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy monorepo workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for dependency resolution
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/

# Install all dependencies needed for web + types
RUN pnpm install --frozen-lockfile --filter @lingtin/web...

# Copy source code
COPY apps/web ./apps/web
COPY packages/types ./packages/types

# Build shared types first, then web app
RUN pnpm --filter @lingtin/types build
RUN pnpm --filter @lingtin/web build

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Run next start directly from the web app directory (avoids pnpm filter workspace issues)
WORKDIR /app/apps/web
CMD ["pnpm", "start"]
