FROM node:lts-slim

WORKDIR /app

# Enable PNPM pinned to a version compatible with Node 20
# pnpm v8 is widely compatible with Node 20; pin to a stable v8 release
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

# Copy package lockfiles first for Docker layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies using strict lockfile
RUN pnpm install --frozen-lockfile

# Copy the entire workspace source
COPY . .

# Build the entire NestJS Monorepo
RUN pnpm run build core-service && pnpm run build identity-service

# Target explicitly the highly-performant production runtime
ENV NODE_ENV=production

# Expose a parameterized execution boundary
CMD ["node", "dist/apps/core-service/main.js"]

