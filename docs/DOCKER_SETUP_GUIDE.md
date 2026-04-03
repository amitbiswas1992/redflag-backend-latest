# 🐳 Docker Setup & Testing Guide

**Status**: Complete Docker support with PostgreSQL included  
**Date**: April 3, 2026  
**Tested**: Docker Compose with automated migrations

## 📋 Prerequisites

- Docker Desktop (macOS/Windows) or Docker + Docker Compose (Linux)
- 4GB+ available RAM for containers
- Port 3000 (backend) and 5432 (database) available

**Check Installation:**
```bash
docker --version
docker-compose --version
# Both should return version info
```

---

## 🚀 Quick Start with Docker (10 minutes)

### Step 1: Copy Environment File
```bash
cd /Users/safiussifat/web-projects/redflag/redflag-backend-latest

cp .env.example .env.local

# ✅ DATABASE_URL is already set correctly for Docker:
# DATABASE_URL="postgresql://postgres:postgres@postgres:5432/redflag_epic?schema=public"
```

### Step 2: Build & Start Containers

**Option A: Complete Setup (Includes DB + Backend)**
```bash
# This will:
# 1. Build Docker images
# 2. Start PostgreSQL container
# 3. Start backend container
# 4. Automatically run migrations
# 5. Expose backend on http://localhost:3000

docker-compose up -d

# Watch startup logs
docker-compose logs -f redflag-epic

# Expected output:
# redflag-epic  | Starting application...
# redflag-epic  | [Nest] 123 - 04/03/2026, 10:30:00 PM     LOG [NestFactory] Nest application successfully started
```

**Option B: Stop Containers**
```bash
docker-compose down

# To also remove database volume (WARNING: deletes data!)
docker-compose down -v
```

### Step 3: Verify Backend is Running
```bash
# Check if backend is accessible
curl http://localhost:3000/api

# Check container status
docker-compose ps

# Should show:
# NAME                COMMAND             STATUS
# redflag-epic        "/app/start.sh"     Up (healthy)
# redflag-postgres    "docker-entrypoint" Up (healthy)
```

### Step 4: Test the Complete Workflow

```bash
# 1. Create a job
JOB_ID=$(curl -s -X POST http://localhost:3000/api/ingestion/v2/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "FLAT_FHIR_CSV",
    "hospitalKey": "test-hospital-001"
  }' | jq -r '.jobId')

echo "Created job: $JOB_ID"

# 2. Upload CSV data
curl -X POST http://localhost:3000/api/ingestion/v2/jobs/$JOB_ID/upload-csv \
  -H "Content-Type: application/json" \
  -d '{
    "csvData": "patient_epic_id,patient_name,patient_dob,encounter_epic_id,encounter_type,observation_epic_id,observation_code\n1001,John Doe,1980-01-15,E001,Emergency,OBS001,VITAL-BP\n"
  }'

# 3. Start persistence job
curl -X POST http://localhost:3000/api/ingestion/v2/jobs/$JOB_ID/start \
  -H "Content-Type: application/json" \
  -d '{}'

# 4. Get results
curl "http://localhost:3000/api/ingestion/v2/jobs/$JOB_ID"

# 5. Verify in database (see "Database Access" section below)
```

---

## 🧪 Testing with Docker

### Unit Tests

```bash
# Run in Docker (cleaner isolation)
docker-compose exec redflag-epic npm test -- date-normalizer.spec.ts

# Expected: 4/4 tests passing
```

### Integration Tests

```bash
# Ensure database is ready
docker-compose exec postgres pg_isready -U postgres

# Run integration tests
docker-compose exec redflag-epic npm test -- ingestion-v2.integration.spec.ts --verbose

# Expected: 5/5 integration tests passing
```

### E2E Tests via REST API

```bash
# Terminal 1: Start containers (already running)
docker-compose ps

# Terminal 2: Run complete workflow (see "Test the Complete Workflow" section above)
```

---

## 🗄️ Database Management with Docker

### Access PostgreSQL CLI

```bash
# Connect to PostgreSQL inside Docker
docker-compose exec postgres psql -U postgres -d redflag_epic

# Common queries:
# List tables:
\dt

# View patients:
SELECT id, epic_id, full_name FROM patients LIMIT 5;

# View entities persisted:
SELECT COUNT(*) as total_patients FROM patients;
SELECT COUNT(*) as total_encounters FROM encounters;
SELECT COUNT(*) as total_observations FROM observations;

# Exit:
\q
```

### Check Database Connection

```bash
# From host machine:
docker-compose exec postgres pg_isready -U postgres

# Expected: "accepting connections"

# Check DATABASE_URL is correct:
echo $DATABASE_URL
# Should show: postgresql://postgres:postgres@postgres:5432/redflag_epic?schema=public
```

### Manual Migrations

```bash
# Run migrations manually
docker-compose exec redflag-epic npm run prisma:migrate:deploy

# Check migration status
docker-compose exec redflag-epic npx prisma migrate status

# Reset database (WARNING: deletes all data)
docker-compose exec redflag-epic npx prisma migrate reset --force
```

### View Database Logs

```bash
# PostgreSQL logs
docker-compose logs postgres

# Full logs with timestamps
docker-compose logs --timestamps postgres
```

### Backup/Restore Database

```bash
# Backup database
docker-compose exec postgres \
  pg_dump -U postgres redflag_epic > backup.sql

# Restore from backup
docker-compose exec -T postgres \
  psql -U postgres redflag_epic < backup.sql

# Check backup file
ls -lh backup.sql
```

---

## 🔧 Configuration

### Environment Variables

Edit `.env.local` before running `docker-compose up`:

```bash
# Server
PORT=3000

# Database (Docker service name: "postgres")
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/redflag_epic?schema=public"

# PostgreSQL (for compose)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=redflag_epic

# Epic Configuration (add your credentials)
EPIC_CLIENT_ID=your-client-id
EPIC_JWT_KEY_ID=your-key-id
# ... other Epic variables
```

### Custom Port

```bash
# Change backend port
PORT=4000 docker-compose up -d

# Backend will be on http://localhost:4000

# Change database port
DB_PORT=6543 docker-compose up -d
```

### Container Names

```bash
# View running containers
docker-compose ps

# Connect directly by name:
docker-compose exec redflag-epic npm run build
docker-compose exec postgres psql -U postgres
```

---

## 🐛 Troubleshooting

### Issue: "Database connection refused"
```bash
# Check PostgreSQL is running
docker-compose ps

# Logs will show:
docker-compose logs postgres

# Ensure database is healthy:
docker-compose exec postgres pg_isready -U postgres

# Wait for healthcheck to pass (takes ~10 seconds)
sleep 15 && curl http://localhost:3000/api
```

### Issue: "Failed to start: port already in use"
```bash
# Kill process using port 3000
lsof -i :3000
kill -9 <PID>

# OR use different port
PORT=4000 docker-compose up -d

# OR check if containers are already running
docker-compose ps
docker-compose stop
docker-compose rm
docker-compose up -d
```

### Issue: "Migrations failed or didn't run"
```bash
# Check logs
docker-compose logs redflag-epic

# Run migrations manually
docker-compose exec redflag-epic npm run prisma:migrate:deploy

# Check migration status
docker-compose exec redflag-epic npx prisma migrate status

# Force reset (WARNING: data loss)
docker-compose exec redflag-epic npx prisma migrate reset --force
```

### Issue: "Backend won't start after database"
```bash
# Wait a bit longer for database healthcheck
sleep 20

# Check if database is actually healthy
docker-compose exec postgres pg_isready -U postgres

# View backend logs
docker-compose logs -f redflag-epic

# Restart both services
docker-compose restart
```

### Issue: "Lost connection after running for a while"
```bash
# Check if container crashed
docker-compose ps

# View error logs
docker-compose logs redflag-epic | tail -50

# Restart
docker-compose restart redflag-epic
```

### Issue: "Tests timeout or hang"
```bash
# Increase timeout for long-running tests
docker-compose exec redflag-epic npm test -- ingestion-v2.integration.spec.ts --timeout=30000

# Or view process
docker-compose exec redflag-epic ps aux
```

---

## 📊 Common Docker Commands Reference

### Container Lifecycle
```bash
# Start services
docker-compose up -d

# Stop services (keeps data)
docker-compose stop

# Stop and remove (keeps data)
docker-compose down

# Stop and remove everything including volumes (DELETES DATA!)
docker-compose down -v

# Restart services
docker-compose restart

# Rebuild images
docker-compose build

# Rebuild and restart
docker-compose build && docker-compose up -d
```

### Logs & Debugging
```bash
# View all logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# Logs for specific service
docker-compose logs redflag-epic
docker-compose logs postgres

# Last 50 lines with timestamps
docker-compose logs --timestamps --tail=50
```

### Execution & Inspection
```bash
# Execute command in container
docker-compose exec redflag-epic npm run build

# Interactive shell in container
docker-compose exec redflag-epic /bin/sh

# View resource usage
docker stats

# View container details
docker-compose ps -a
docker inspect redflag-epic
```

### Volume Management
```bash
# List volumes
docker volume ls

# View volume details
docker volume inspect postgres_data

# Clean unused volumes
docker volume prune -f
```

---

## 🚀 Complete Workflow Example

```bash
#!/bin/bash
# Complete setup and test script

set -e  # Exit on error

echo "🐳 RedFlag Backend - Docker Quick Start"

# Step 1: Prepare
echo "📦 Preparing environment..."
cd /Users/safiussifat/web-projects/redflag/redflag-backend-latest
cp .env.example .env.local
echo "✅ Environment ready"

# Step 2: Start containers
echo "🚀 Starting containers..."
docker-compose down -v 2>/dev/null || true
docker-compose up -d
echo "⏳ Waiting for database healthcheck..."
sleep 15

# Step 3: Verify
echo "🔍 Verifying setup..."
docker-compose ps
docker-compose exec postgres pg_isready -U postgres
echo "✅ Containers running"

# Step 4: Run tests
echo "🧪 Running tests..."
docker-compose exec redflag-epic npm test -- date-normalizer.spec.ts
docker-compose exec redflag-epic npm test -- ingestion-v2.integration.spec.ts
echo "✅ Tests passed"

# Step 5: Manual test
echo "🌐 Running manual API test..."
JOB_ID=$(curl -s -X POST http://localhost:3000/api/ingestion/v2/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "FLAT_FHIR_CSV",
    "hospitalKey": "test-001"
  }' | jq -r '.jobId')

echo "✅ Created job: $JOB_ID"

# Step 6: Cleanup (optional)
echo "🧹 To stop containers, run:"
echo "   docker-compose down"
echo "🎉 Setup complete!"
```

Save as `setup-docker.sh` and run:
```bash
chmod +x setup-docker.sh
./setup-docker.sh
```

---

## 📈 Docker Compose Architecture

```
┌─────────────────────────────────────────┐
│         Your Machine                     │
│  ┌──────────────────────────────────┐  │
│  │  redflag-network (Docker bridge) │  │
│  │  ┌────────────────────────────┐  │  │
│  │  │  redflag-epic container    │  │  │
│  │  │  Port: 3000                │  │  │
│  │  │  - NestJS app              │  │  │
│  │  │  - Migrations (auto-run)   │  │  │
│  │  │  - Node.js 20-slim         │  │  │
│  │  └────────────────────────────┘  │  │
│  │            ↕ (localhost:5432)     │  │
│  │  ┌────────────────────────────┐  │  │
│  │  │  redflag-postgres          │  │  │
│  │  │  Port: 5432 (host: 5432)   │  │  │
│  │  │  - PostgreSQL 16-alpine    │  │  │
│  │  │  - Volume: postgres_data   │  │  │
│  │  │  - Auto-healthcheck        │  │  │
│  │  └────────────────────────────┘  │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘

```

---

## ✅ Verification Checklist

- [ ] Docker Desktop/Docker Compose installed
- [ ] Port 3000 and 5432 available
- [ ] .env.local copied from .env.example
- [ ] `docker-compose up -d` runs without errors
- [ ] `docker-compose ps` shows both containers healthy
- [ ] Database accessible: `docker-compose exec postgres pg_isready`
- [ ] Backend API responds: `curl http://localhost:3000/api`
- [ ] Unit tests pass: `docker-compose exec redflag-epic npm test`
- [ ] Integration tests pass: `npm test -- ingestion-v2.integration.spec.ts`
- [ ] Manual workflow completes (create job → upload → persist → query)

---

## 🎯 Next Steps

1. **Run Docker setup** (this guide)
2. **Complete testing** (see BACKEND_TESTING_GUIDE.md for all phases)
3. **Validate idempotency** (re-run same CSV, verify no duplicates)
4. **Test with production data** (real FHIR CSV samples)

---

## 📝 Notes

- **Automatic migrations**: Backend container runs `npm run prisma:migrate:deploy` automatically on startup
- **Health checks**: PostgreSQL has automated health checks; backend waits for DB readiness
- **Data persistence**: PostgreSQL data stored in named volume `postgres_data` (survives restarts, removed only by `docker-compose down -v`)
- **Port mapping**: Backend: 3000→3000, Database: 5432→5432 (adjust with PORT and DB_PORT env vars)
- **Network**: Both containers on `redflag-network` bridge; communication by service name

Any issues? Run: `docker-compose logs -f` to see real-time output from both services.
