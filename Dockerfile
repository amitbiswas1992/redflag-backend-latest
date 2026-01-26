# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install OpenSSL for Prisma (required for PostgreSQL connection)
# Prisma's musl binary needs OpenSSL 1.1.x, try compatibility package first
RUN apk add --no-cache openssl1.1-compat 2>/dev/null || \
    (apk add --no-cache openssl && \
     echo "Note: Using OpenSSL 3.x, Prisma may need compatibility layer")

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production --legacy-peer-deps && npm cache clean --force

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma Client in production stage
# (prisma is in dependencies, so it's available)
RUN npx prisma generate

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy any necessary files (like scripts, configs)
COPY --from=builder /app/scripts ./scripts

# Copy private key
COPY --from=builder /app/private_key.pem ./private_key.pem
# Copy public key
COPY --from=builder /app/public_key.pem ./public_key.pem


# Expose port
EXPOSE 3000

# Set NODE_ENV
ENV NODE_ENV=production

# Set Prisma environment variable to help with OpenSSL compatibility
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl.so.node

# Start the application
CMD ["node", "dist/main"]

