FROM node:22.14-slim

WORKDIR /app

# Enable PNPM
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package lockfiles first for Docker layer caching
COPY package.json pnpm-lock.yaml ./

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

