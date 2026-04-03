# 🐳 Docker Command Reference & Quick Test Guide

**Last Updated**: April 3, 2026  
**Status**: Ready for Production Local Testing  

---

## ⚡ TL;DR - Get Running in 2 Minutes

```bash
cd /Users/safiussifat/web-projects/redflag/redflag-backend-latest

# 1. Prepare
cp .env.example .env.local

# 2. Start (backend + database)
docker-compose up -d

# 3. Wait for database
sleep 15

# 4. Test
curl http://localhost:3000/api

# ✅ Done! Backend on http://localhost:3000, Database on localhost:5432
```

---

## 📋 Complete Docker Command Reference

### Lifecycle Commands

| Command | Purpose |
|---------|---------|
| `docker-compose up -d` | Start backend + database in background |
| `docker-compose up` | Start and show logs |
| `docker-compose stop` | Stop containers (preserves data) |
| `docker-compose down` | Stop and remove containers (preserves data) |
| `docker-compose down -v` | Stop, remove containers AND delete database |
| `docker-compose restart` | Restart all containers |
| `docker-compose build` | Rebuild Docker images |

### Container Status

| Command | Purpose |
|---------|---------|
| `docker-compose ps` | Show running/stopped containers |
| `docker-compose logs -f` | Follow all container logs |
| `docker-compose logs redflag-epic` | Backend logs only |
| `docker-compose logs postgres` | Database logs only |
| `docker inspect redflag-epic` | Detailed container info |
| `docker stats` | CPU/Memory usage |

### Testing Inside Containers

| Command | Purpose |
|---------|---------|
| `docker-compose exec redflag-epic npm test` | Run all tests |
| `docker-compose exec redflag-epic npm test -- date-normalizer.spec.ts` | Unit tests |
| `docker-compose exec redflag-epic npm test -- ingestion-v2.integration.spec.ts` | Integration tests |
| `docker-compose exec redflag-epic npm run build` | Rebuild application |
| `docker-compose exec redflag-epic /bin/sh` | Shell access to backend |

### Database Access

| Command | Purpose |
|---------|---------|
| `docker-compose exec postgres psql -U postgres -d redflag_epic` | Connect to database |
| `docker-compose exec postgres pg_isready -U postgres` | Check database ready |
| `docker-compose exec postgres pg_dump -U postgres redflag_epic > backup.sql` | Backup database |
| `docker-compose exec -T postgres psql -U postgres redflag_epic < backup.sql` | Restore database |

---

## 🧪 Complete Testing Workflow with Docker

### Phase 0: Setup (Verify Docker Installation)

```bash
# Verify Docker is installed
docker --version
docker-compose --version

# Navigate to project
cd /Users/safiussifat/web-projects/redflag/redflag-backend-latest

# Copy environment
cp .env.example .env.local

# Verify .env.local exists
cat .env.local | grep DATABASE_URL
# Should show: DATABASE_URL="postgresql://postgres:postgres@postgres:5432/redflag_epic?schema=public"
```

### Phase 1: Start Containers & Verify Database

```bash
# Start containers
docker-compose up -d

# Wait for database healthcheck (should show "healthy")
sleep 15 && docker-compose ps

# Verify database is ready
docker-compose exec postgres pg_isready -U postgres

# Expected output: "accepting connections"

# Connect to database and verify schema
docker-compose exec postgres psql -U postgres -d redflag_epic -c "\dt"

# Expected: Tables like ingestion_jobs_v2, ingestion_row_results_v2, patients, encounters, etc.
```

### Phase 2: Run Unit Tests

```bash
# Run date normalizer tests (should pass 4/4)
docker-compose exec redflag-epic npm test -- date-normalizer.spec.ts

# Expected output:
# PASS  src/ingestion/v2/date-normalizer.spec.ts
#   ✓ should parse dates with accepted format
#   ✓ should reject ambiguous dates
#   ✓ should handle timezone conversion
#   ✓ should apply timezone rules

# Test count
Tests:       4 passed, 4 total
```

### Phase 3: Run Integration Tests

```bash
# Run integration tests (5 tests)
docker-compose exec redflag-epic npm test -- ingestion-v2.integration.spec.ts --verbose

# Expected output:
# PASS  src/ingestion/v2/ingestion-v2.integration.spec.ts
#   ✓ should create a new ingestion job
#   ✓ should upload CSV and validate rows
#   ✓ should persist entities on job start
#   ✓ should handle multi-entity row with 8 entity types
#   ✓ should handle idempotent upserts

# All 5 tests passing
```

### Phase 4: Manual E2E Test (REST API)

```bash
# Terminal 1: Verify backend is running
curl http://localhost:3000/api

# Terminal 2: Run complete workflow

# 1. Create a job
JOB_ID=$(curl -s -X POST http://localhost:3000/api/ingestion/v2/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "FLAT_FHIR_CSV",
    "hospitalKey": "test-hospital-001"
  }' | jq -r '.jobId')

echo "Created job: $JOB_ID"

# 2. Upload sample CSV
curl -s -X POST http://localhost:3000/api/ingestion/v2/jobs/$JOB_ID/upload-csv \
  -H "Content-Type: application/json" \
  -d '{
    "csvData": "patient_epic_id,patient_name,patient_dob,encounter_epic_id,encounter_type,observation_epic_id,observation_code,condition_epic_id,condition_code,medication_epic_id,medication_name,allergy_epic_id,allergy_substance,procedure_epic_id,procedure_name,diagnostic_report_epic_id,diagnostic_report_code,practitioner_epic_id,practitioner_name\n1001,John Doe,1980-01-15,E001,Emergency,OBS001,VITAL-BP,C001,ICD-10,M001,Aspirin,A001,Penicillin,P001,Blood Test,DR001,Lab Result,PR001,Dr.Smith\n"
  }'

# 3. Start job (persist entities)
curl -s -X POST http://localhost:3000/api/ingestion/v2/jobs/$JOB_ID/start \
  -H "Content-Type: application/json" \
  -d '{}'

# 4. Get job status
curl -s http://localhost:3000/api/ingestion/v2/jobs/$JOB_ID | jq .

# Expected: status: "COMPLETED", persistedCount: 9 (patient + 8 related entities)

# 5. Get results
curl -s "http://localhost:3000/api/ingestion/v2/jobs/$JOB_ID/results?page=1&pageSize=50" | jq '.data[0]'
```

### Phase 5: Verify Data in Database

```bash
# Connect to database
docker-compose exec postgres psql -U postgres -d redflag_epic

# Inside psql:

# Count all entities
SELECT 'Patients' as entity, COUNT(*) as count FROM patients
UNION ALL
SELECT 'Practitioners', COUNT(*) FROM practitioners
UNION ALL
SELECT 'Encounters', COUNT(*) FROM encounters
UNION ALL
SELECT 'Observations', COUNT(*) FROM observations
UNION ALL
SELECT 'Conditions', COUNT(*) FROM conditions
UNION ALL
SELECT 'Medications', COUNT(*) FROM medications
UNION ALL
SELECT 'Allergies', COUNT(*) FROM allergies
UNION ALL
SELECT 'Procedures', COUNT(*) FROM procedures
UNION ALL
SELECT 'Diagnostic Reports', COUNT(*) FROM diagnostic_reports;

# Expected all counts ≥ 1

# Verify specific patient
SELECT id, epic_id, full_name FROM patients WHERE epic_id = '1001';

# Verify encounters for patient
SELECT e.id, e.epic_id, e.encounter_type FROM encounters e
JOIN patients p ON e.patient_id = p.id
WHERE p.epic_id = '1001';

# Exit
\q
```

### Phase 6: Test Idempotency

```bash
# Count patients before re-run
docker-compose exec postgres psql -U postgres -d redflag_epic -c \
  "SELECT COUNT(*) FROM patients WHERE epic_id = '1001';"

# Expected: 1

# Upload SAME CSV again
JOB_ID_2=$(curl -s -X POST http://localhost:3000/api/ingestion/v2/jobs \
  -H "Content-Type: application/json" \
  -d '{"sourceType":"FLAT_FHIR_CSV","hospitalKey":"test-hospital-001"}' | jq -r '.jobId')

curl -s -X POST http://localhost:3000/api/ingestion/v2/jobs/$JOB_ID_2/upload-csv \
  -H "Content-Type: application/json" \
  -d '{"csvData":"patient_epic_id,patient_name,patient_dob\n1001,John Doe,1980-01-15\n"}' > /dev/null

curl -s -X POST http://localhost:3000/api/ingestion/v2/jobs/$JOB_ID_2/start \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null

# Count patients after re-run
docker-compose exec postgres psql -U postgres -d redflag_epic -c \
  "SELECT COUNT(*) FROM patients WHERE epic_id = '1001';"

# Expected: Still 1 (not 2!) - upsert by epicId is idempotent
```

### Phase 7: Cleanup

```bash
# Stop containers without losing data
docker-compose stop

# Stop and remove containers (keeps data in postgres_data volume)
docker-compose down

# Full cleanup including database (WARNING: deletes data!)
docker-compose down -v
```

---

## 🛠️ Troubleshooting with Docker

### "Docker command not found"

```bash
# Install Docker Desktop (macOS)
# Or install Docker + Docker Compose via homebrew:
brew install docker docker-compose
# Or via Docker Desktop:
# Download from https://www.docker.com/products/docker-desktop
```

### "port 3000 already in use"

```bash
# Option 1: Use different port
PORT=4000 docker-compose up -d

# Option 2: Kill existing process
lsof -i :3000
kill -9 <PID>

# Option 3: Remove existing containers
docker-compose down
docker-compose up -d
```

### "database connection refused"

```bash
# Check database is running and healthy
docker-compose ps
# redflag-postgres should show "Up (healthy)"

# If not healthy, wait a bit longer
sleep 15 && docker-compose ps

# Check database logs
docker-compose logs postgres

# Verify healthcheck manually
docker-compose exec postgres pg_isready -U postgres
```

### "migrations didn't run"

```bash
# Check if migrations ran in startup
docker-compose logs redflag-epic | grep "migrations"

# Run migrations manually
docker-compose exec redflag-epic npm run prisma:migrate:deploy

# Check migration status
docker-compose exec redflag-epic npx prisma migrate status

# View migration errors
docker-compose exec redflag-epic npx prisma migrate resolve --rolled-back
```

### "tests times out or fails"

```bash
# View test output in detail
docker-compose exec redflag-epic npm test -- date-normalizer.spec.ts --verbose

# With longer timeout (30 seconds)
docker-compose exec redflag-epic npm test -- ingestion-v2.integration.spec.ts --timeout=30000

# Check if database has data from previous test
docker-compose exec postgres psql -U postgres -d redflag_epic -c \
  "SELECT COUNT(*) FROM patients;"

# Restart with clean database (deletes data!)
docker-compose down -v
docker-compose up -d
sleep 15
```

### "can't connect to backend from browser"

```bash
# Verify backend is running
docker-compose ps
# redflag-epic should show "Up"

# Check backend logs
docker-compose logs redflag-epic

# Verify port mapping
docker port redflag-epic
# Should show: 3000/tcp -> 0.0.0.0:3000

# Test with curl
curl http://localhost:3000/api

# If curl works but browser doesn't, check firewall
# Or try: http://127.0.0.1:3000 instead of localhost
```

---

## 📊 Quick Status Checks

```bash
# All-in-one health check
echo "=== Docker Status ===" && docker-compose ps && \
echo -e "\n=== Database Connection ===" && docker-compose exec postgres pg_isready -U postgres && \
echo -e "\n=== Backend Response ===" && curl -s http://localhost:3000/api | jq . && \
echo -e "\n=== Database Tables ===" && docker-compose exec postgres psql -U postgres -d redflag_epic -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" && \
echo -e "\n✅ All systems operational!"
```

---

## 🔄 Docker Compose File Structure

```yaml
version: '3.8'
services:
  postgres:               # PostgreSQL 16 database
    - Runs on localhost:5432
    - Auto-healthcheck
    - Data persists in postgres_data volume
  
  redflag-epic:          # NestJS backend
    - Runs on localhost:3000
    - Depends on postgres being healthy
    - Auto-runs migrations on startup
    - Environment variables from .env.local

volumes:
  postgres_data:         # Database storage (survives restarts)

networks:
  redflag-network:       # Connects postgres & backend
```

---

## 📝 Useful Environment Variables

```bash
# For .env.local

# Server
PORT=3000                # Backend port (default: 3000)
DB_PORT=5432             # Database port (default: 5432)

# Database
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/redflag_epic?schema=public"
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=redflag_epic

# Node environment
NODE_ENV=production      # or "development"

# Epic configuration (add your values)
EPIC_CLIENT_ID=your-id
EPIC_USE_SANDBOX=true
EPIC_JWT_KEY_ID=your-key-id
# ... etc
```

---

## ✅ Pre-Launch Checklist

- [ ] Docker Desktop/Docker Compose installed
- [ ] Ports 3000 and 5432 available
- [ ] `.env.local` copied from `.env.example`
- [ ] `docker-compose.yml` contains both postgres and redflag-epic services
- [ ] `Dockerfile` has migration startup script
- [ ] Network and volume setup correct in docker-compose.yml

---

## 🚀 One-Liner to Test Everything

```bash
cd /Users/safiussifat/web-projects/redflag/redflag-backend-latest && \
cp .env.example .env.local && \
docker-compose down -v 2>/dev/null ; \
docker-compose up -d && \
sleep 15 && \
docker-compose exec redflag-epic npm test -- date-normalizer.spec.ts && \
docker-compose exec redflag-epic npm test -- ingestion-v2.integration.spec.ts && \
echo "✅ All tests passed!" || echo "❌ Tests failed"
```

Save as `test-docker.sh`:
```bash
chmod +x test-docker.sh
./test-docker.sh
```

---

**For detailed Docker setup, see:** [DOCKER_SETUP_GUIDE.md](DOCKER_SETUP_GUIDE.md)  
**For traditional local setup, see:** [PROJECT_SETUP_GUIDE.md](PROJECT_SETUP_GUIDE.md)  
**For testing procedures, see:** [BACKEND_TESTING_GUIDE.md](BACKEND_TESTING_GUIDE.md)
