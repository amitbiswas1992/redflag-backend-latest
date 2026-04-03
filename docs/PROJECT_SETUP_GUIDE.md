# 🚀 Project Setup & Backend Testing - Complete Guide

**Branch**: `feat/phase1-entity-persistence`  
**Status**: Ready for Local Development & Testing  
**Last Updated**: April 3, 2026

---

## 🐳 RECOMMENDED: Docker Setup (Easiest - 10 minutes)

### ⭐ Why Docker?
- **Zero configuration**: No local PostgreSQL installation needed
- **Reproducible environment**: Same setup on all machines
- **Automatic migrations**: Database schema updates run automatically
- **Easy cleanup**: Stop containers, data persists; `docker-compose down -v` to reset
- **Perfect for testing**: Isolated, repeatable test runs

### Quick Docker Start
```bash
cd /Users/safiussifat/web-projects/redflag/redflag-backend-latest

# 1. Copy environment
cp .env.example .env.local

# 2. Start everything (database + backend)
docker-compose up -d

# 3. Wait 15 seconds for database healthcheck
sleep 15

# 4. Verify it's running
docker-compose ps
curl http://localhost:3000/api

# ✅ Done! Backend is running on http://localhost:3000

# Stop when done
docker-compose down
```

**👉 For complete Docker instructions, see [DOCKER_SETUP_GUIDE.md](DOCKER_SETUP_GUIDE.md)**

---

## 📝 Traditional Local Setup (Alternative)

If you prefer to run PostgreSQL locally instead of Docker:

### 1️⃣ Clone & Install
```bash
cd /Users/safiussifat/web-projects/redflag/redflag-backend-latest

# Verify on correct branch
git branch  # Should show: * feat/phase1-entity-persistence

# Install dependencies
npm install

# Verify build
npm run build  # Should complete with 0 errors
```

### 2️⃣ Configure Database
```bash
# Copy environment
cp .env.example .env.local

# Update if needed (default usually works)
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/redflag_epic?schema=public
```

### 3️⃣ Setup Local PostgreSQL
```bash
# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql@14

# OR start with Docker just the database:
docker-compose up -d postgres

# Run migrations
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/redflag_epic?schema=public"
npx prisma migrate reset --force  # Fresh DB, or
npx prisma migrate deploy         # Incremental
```

### 4️⃣ Run Tests
```bash
# Unit tests
npm test -- date-normalizer.spec.ts  # Should show 4/4 passing

# Integration tests (if DB is ready)
npm test -- ingestion-v2.integration.spec.ts
```

### 5️⃣ Start Backend
```bash
npm run start

# Server runs on http://localhost:3000
# API Docs at http://localhost:3000/api
```

---

## 📁 Project Documentation Structure

After Phase 1 implementation, all documentation is organized as follows:

```
redflag-backend-latest/
├── docs/
│   ├── DOCKER_SETUP_GUIDE.md            ← 🐳 Complete Docker guide
│   ├── BACKEND_TESTING_GUIDE.md         ← 🧪 6-phase testing guide
│   ├── PHASE1_ENTITY_PERSISTENCE_SUMMARY.md ← 📚 Technical reference
│   ├── QUICK_START.md                   ← ⚡ Quick overview
│   └── README.md                        ← 📖 Documentation index
└── ... (other project files)
```

---

## 📖 Complete Testing Guide

### For Step-by-Step Instructions:
👉 **See `docs/BACKEND_TESTING_GUIDE.md`**

This 300+ line guide covers:

#### Phase 0: Setup & Validation (✅ Prerequisites)
- System requirements
- Node/PostgreSQL setup
- Environment configuration
- Git branch verification

#### Phase 1: Database Migration & Setup (🗄️ Database)
- Initialize schema
- Create/reset database
- Verify migrations
- Check table structure

#### Phase 2: Unit Tests (✅ Validation)
- Date normalization tests (4/4 passing)
- All package tests
- No regressions

#### Phase 3: Integration Tests (🔗 Entity Persistence)
- Full job lifecycle test
- Entity persistence verification
- Idempotent upsert test
- Multi-entity row support

#### Phase 4: Manual E2E Testing (🌐 REST API)
- Start backend server
- Test job creation: `POST /api/ingestion/v2/jobs`
- Test CSV upload: `POST /api/ingestion/v2/jobs/:id/upload-csv`
- Test job start (entity persistence): `POST /api/ingestion/v2/jobs/:id/start`
- Test status: `GET /api/ingestion/v2/jobs/:id`
- Test results: `GET /api/ingestion/v2/jobs/:id/results`

#### Phase 5: Testing Idempotency (🔄 Data Integrity)
- Re-run same job
- Verify no duplicates (upsert by epicId)
- Check timestamps update

#### Phase 6: Error Handling (⚠️ Edge Cases)
- Invalid CSV format
- Missing required fields
- Error diagnostics
- Row-level error reporting

---

## 🧪 Test Commands Reference

### Using Docker (Recommended)
```bash
# Build Docker images
docker-compose build

# Run backend in Docker
docker-compose up -d

# Run unit tests in Docker
docker-compose exec redflag-epic npm test -- date-normalizer.spec.ts

# Run integration tests in Docker
docker-compose exec redflag-epic npm test -- ingestion-v2.integration.spec.ts --verbose

# Access database in Docker
docker-compose exec postgres psql -U postgres -d redflag_epic
```

### Using Local Development
```bash
# Build project
npm run build

# Run unit tests (date normalization)
npm test -- date-normalizer.spec.ts

# Run ALL tests
npm test

# Run integration tests (requires DB)
npm test -- ingestion-v2.integration.spec.ts --verbose

# Start development server
npm run start


# Generate Prisma Client types
npx prisma generate

# Check schema validity
npx prisma validate

# Reset database (⚠️ deletes all data)
npx prisma migrate reset --force

# Deploy migrations (safe)
npx prisma migrate deploy

# View database interactively
psql -U postgres -d redflag_epic
```

---

## 🌐 REST API Endpoints (Phase 1)

All endpoints run on `http://localhost:3000`:

### 1. Create Job
```bash
POST /api/ingestion/v2/jobs
Content-Type: application/json

{
  "sourceType": "FLAT_FHIR_CSV",
  "hospitalKey": "hospital-001",
  "templateVersion": "1.0.0"
}

# Response: { jobId, status: "CREATED", ... }
```

### 2. Upload CSV
```bash
POST /api/ingestion/v2/jobs/{jobId}/upload-csv
Content-Type: application/json

{
  "csvData": "patient_epic_id,patient_name,...\npatient-001,John Doe,..."
}

# Response: { status: "UPLOADED", totalRows, successRows, failedRows, ... }
```

### 3. Start Job (Persist Entities)
```bash
POST /api/ingestion/v2/jobs/{jobId}/start
Content-Type: application/json

{}

# Response: { status: "COMPLETED", persistedCount, ... }
```

### 4. Get Job Status
```bash
GET /api/ingestion/v2/jobs/{jobId}

# Response: Complete job object with all metadata
```

### 5. Get Row Results (Paginated)
```bash
GET /api/ingestion/v2/jobs/{jobId}/results?page=1&pageSize=50

# Response: { rows, total, page, pageSize }
```

---

## 📊 Example: Full Workflow

```bash
# Terminal 1: Start backend
npm run start

# Terminal 2: Run workflow

# 1. Create job
JOB=$(curl -s -X POST http://localhost:3000/api/ingestion/v2/jobs \
  -H "Content-Type: application/json" \
  -d '{"sourceType":"FLAT_FHIR_CSV","hospitalKey":"test-001"}' | jq -r .jobId)

echo "Created job: $JOB"

# 2. Upload CSV
CSV=$(cat samples/flat-fhir/flat-fhir-export.csv)

curl -s -X POST http://localhost:3000/api/ingestion/v2/jobs/$JOB/upload-csv \
  -H "Content-Type: application/json" \
  -d "{\"csvData\":\"$CSV\"}" | jq '.status, .totalRows, .successRows'

# 3. Start job (entity persistence)
curl -s -X POST http://localhost:3000/api/ingestion/v2/jobs/$JOB/start \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.status, .persistedCount, .completedAt'

# 4. Check results
curl -s http://localhost:3000/api/ingestion/v2/jobs/$JOB/results?page=1 | jq '.rows | length'

# 5. Verify database
psql -U postgres -d redflag_epic -c "SELECT COUNT(*) FROM patients;"
```

---

## 🔍 Verification Checklist

### Code & Build
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] `npm test` shows 4/4 date normalization tests passing
- [ ] `npx prisma validate` succeeds
- [ ] Branch is `feat/phase1-entity-persistence`

### Database
- [ ] PostgreSQL running (or Docker container)
- [ ] `.env.local` has valid `DATABASE_URL`
- [ ] Migrations applied successfully
- [ ] `ingestion_jobs_v2` table created
- [ ] `ingestion_row_results_v2` table created with `row_data` column

### API Testing
- [ ] Backend starts without errors (`npm run start`)
- [ ] Job creation endpoint responds 200
- [ ] CSV upload endpoint accepts data
- [ ] Job start endpoint triggers persistence
- [ ] Results endpoint returns paginated data

### Data Integrity
- [ ] Patient records persisted with correct `epicId`
- [ ] Encounter linked to correct Patient (foreign key)
- [ ] Second job with same data doesn't create duplicates (idempotent upsert)
- [ ] Error rows tracked correctly in results

---

## 🛠️ Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL is running
brew services list | grep postgres

# OR check Docker container
docker ps | grep postgres

# Start if needed
brew services start postgresql@14
# or
docker-compose up -d postgres
```

### TypeScript Compilation Error
```bash
# Regenerate Prisma types
npx prisma generate

# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Test Failures
```bash
# Make sure DB is ready first
npx prisma migrate deploy

# Run date normalizer test (doesn't need DB)
npm test -- date-normalizer.spec.ts

# If that passes, DB-dependent tests should work
npm test -- ingestion-v2.integration.spec.ts
```

### Port 3000 Already in Use
```bash
# Find and kill process
lsof -i :3000  # Find PID
kill -9 <PID>

# Or use different port (update .env if needed)
```

---

## 📚 Documentation Files

All documentation located in `docs/` folder:

| File | Purpose | Audience |
|---|---|---|
| **BACKEND_TESTING_GUIDE.md** | Complete step-by-step testing (6 phases) | Developers |
| **PHASE1_ENTITY_PERSISTENCE_SUMMARY.md** | Technical implementation details | Architects |
| **QUICK_START.md** | Quick reference for common tasks | Everyone |

Additional docs:
- `OVERVIEW of REDFLAG-EPIC INTEGRATION.md` - System architecture
- `samples/flat-fhir/README.md` - Sample data explanation

---

## 🎯 What Gets Tested

### Unit Level
✅ Date normalization (4 test cases)  
✅ CSV header parsing  
✅ Entity extraction logic

### Integration Level
✅ Full job lifecycle (create → upload → persist)  
✅ Entity persistence (9 types)  
✅ Idempotent upserts (deterministic by epicId)  
✅ Error tracking and diagnostics

### Manual E2E Level
✅ REST API endpoints  
✅ CSV parsing and validation  
✅ Database persistence  
✅ Multi-entity relationships  
✅ Pagination results

---

## 📈 What's Been Implemented (Phase 1)

### Code
- ✅ Entity normalizer (`src/ingestion/v2/entity-normalizer.ts`)
- ✅ V2 service enhancements (`src/ingestion/v2/ingestion-v2.service.ts`)
- ✅ Integration tests (`src/ingestion/v2/ingestion-v2.integration.spec.ts`)

### Database
- ✅ 2 new migrations for v2 tables and columns
- ✅ 9 entity types supported (Patient, Practitioner, Encounter, Observation, Condition, Medication, Allergy, Procedure, DiagnosticReport)
- ✅ Row data storage for audit trail
- ✅ Deterministic upserts by epicId

### API  
- ✅ 5 REST endpoints for job management
- ✅ Full error handling with row-level diagnostics
- ✅ Pagination support for results

### Documentation
- ✅ Complete testing guide (6 phases, 300+ lines)
- ✅ Technical summary of implementation
- ✅ Quick reference guide
- ✅ This comprehensive setup guide

---

## 🚀 Next Phase (Phase 2)

After Phase 1 validation:
1. Frontend cutover to v2 job APIs
2. Risk engine integration  
3. Bulk upsert optimization (batch entities)
4. Enhanced practitioner linking
5. Audit trail improvements

---

## 💡 Key Concepts

**Deterministic Upserts**: All entities use `epicId` as natural key. Re-running same job produces identical DB state (idempotent).

**Entity Normalizer**: Converts flat CSV row → 9 FHIR entities. No external IDs needed.

**Row Data Persistence**: Original CSV row stored as JSONB for future replays/audits.

**Per-Row Error Tracking**: Each row result includes outcome, reason code, and message for diagnostics.

---

## ❓ Common Questions

**Q: How do I know if entity persistence is working?**  
A: Check `persistedCount > 0` in the job start response, then query the database for Patient records with the epicId.

**Q: What if I get different results running the same CSV twice?**  
A: You shouldn't! Upserts are deterministic by epicId. If you see duplicates, there's a bug. Check entity epilds in your CSV.

**Q: How do I reset everything?**  
A: `npx prisma migrate reset --force` - this wipes and recreates the entire DB.

**Q: Can I run this on Windows/Linux?**  
A: Yes! The project is Docker-ready. Use Docker Compose for PostgreSQL and the same npm commands work on any OS.

---

## 📞 Support

- **Technical Issues**: Check `docs/BACKEND_TESTING_GUIDE.md` troubleshooting section
- **Implementation Details**: See `docs/PHASE1_ENTITY_PERSISTENCE_SUMMARY.md`
- **Code Reference**: See individual test files and sample data in `samples/flat-fhir/`

---

**Status: Backend Phase 1 Ready for Testing** ✅

Everything is set up for local development and testing. Follow the verification checklist and run the E2E test workflow to validate.

Good luck! 🎉

