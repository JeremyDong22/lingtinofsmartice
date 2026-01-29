# Dockerfile for Lingtin API - v1.5
# NestJS backend with FFmpeg support for audio processing
# Build from monorepo root: docker build -f apps/api/Dockerfile -t <image> .
# v1.5 - Move build tools to dependencies for reliable Docker builds

FROM node:18-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/

# Install dependencies (build tools now in dependencies)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source code
COPY apps/api ./apps/api
COPY packages/types ./packages/types

# Build
WORKDIR /app/apps/api
RUN pnpm build

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
