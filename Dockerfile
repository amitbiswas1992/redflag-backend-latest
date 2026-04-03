FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma and curl for healthchecks
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install  --legacy-peer-deps

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create a script to run migrations and start the app
RUN echo '#!/bin/sh\necho "Waiting for database..."\necho "Running migrations..."\nnpm run prisma:migrate:deploy 2>/dev/null || true\necho "Starting application..."\nnode dist/main' > /app/start.sh && chmod +x /app/start.sh

# Set NODE_ENV
ENV NODE_ENV=production

# Start the application with migration handling
CMD ["/app/start.sh"]

