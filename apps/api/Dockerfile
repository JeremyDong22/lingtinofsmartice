# Dockerfile for Lingtin API - v1.4
# NestJS backend with FFmpeg support for audio processing
# Build from monorepo root: docker build -f apps/api/Dockerfile -t <image> .
# v1.4 - Use multi-stage build per pnpm docs to properly handle devDependencies

FROM node:18-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache ffmpeg 2>/dev/null || apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Build stage - install all deps including devDependencies
FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY apps/api ./apps/api
COPY packages/types ./packages/types
WORKDIR /app/apps/api
RUN pnpm build

# Production deps stage
FROM base AS prod-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

# Final stage
FROM base
WORKDIR /app/apps/api
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY apps/api/package.json ./

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
