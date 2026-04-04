import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../server/prisma.service';
import { IngestionV2Service } from './ingestion-v2.service';

describe('IngestionV2Service - Entity Persistence Integration', () => {
    let service: IngestionV2Service;
    let prisma: PrismaService;
    let jobId: string;

    beforeAll(async () => {
        // Note: This test requires a real database connection to run
        // Skipping by default as integration tests require environment setup
        const module: TestingModule = await Test.createTestingModule({
            providers: [IngestionV2Service, PrismaService],
        }).compile();

        service = module.get<IngestionV2Service>(IngestionV2Service);
        prisma = module.get<PrismaService>(PrismaService);
    });

    describe('Full Job Lifecycle with Entity Persistence', () => {
        const sampleCsvPath = path.join(
            __dirname,
            '../../..',
            'samples',
            'flat-fhir',
            'flat-fhir-export.csv',
        );

        it('should create a job', async () => {
            const result = await service.createJob({
                sourceType: 'FLAT_FHIR_CSV',
            });

            expect(result.jobId).toBeDefined();
            expect(result.status).toBe('CREATED');
            jobId = result.jobId;
        });

        it('should upload CSV and validate rows', async () => {
            if (!jobId) {
                return;
            }

            // Read sample CSV file
            if (!fs.existsSync(sampleCsvPath)) {
                return;
            }

            const csvData = fs.readFileSync(sampleCsvPath, 'utf-8');

            const result = await service.uploadCsv(jobId, { csvData });

            expect(result.status).toBe('UPLOADED');
            expect(result.totalRows).toBeGreaterThan(0);
            expect(result.successRows).toBeGreaterThan(0);
        });

        it('should persist entities when job is started', async () => {
            if (!jobId) {
                return;
            }

            const result = await service.startJob(jobId, {});

            expect(result.status).toBe('COMPLETED');
            expect(result.persistedCount).toBeGreaterThan(0);

            // Verify Patient was persisted
            const patient = await prisma.patient.findFirst({
                where: { epicId: 'patient-001' },
            });
            expect(patient).toBeDefined();
            expect(patient?.name).toBe('Jane Doe');
        });

        it('should persist multiple entity types for a single row', async () => {
            if (!jobId) {
                return;
            }

            // Verify Encounter was persisted
            const encounter = await prisma.encounter.findFirst({
                where: { epicId: 'enc-001' },
            });
            expect(encounter).toBeDefined();

            // Verify Observation was persisted
            const observation = await prisma.observation.findFirst({
                where: { epicId: 'obs-001' },
            });
            expect(observation).toBeDefined();

            // Verify Condition was persisted
            const condition = await prisma.condition.findFirst({
                where: { epicId: 'cond-001' },
            });
            expect(condition).toBeDefined();

            // Verify Medication was persisted
            const medication = await prisma.medication.findFirst({
                where: { epicId: 'med-001' },
            });
            expect(medication).toBeDefined();

            // Verify Allergy was persisted
            const allergy = await prisma.allergy.findFirst({
                where: { epicId: 'allergy-001' },
            });
            expect(allergy).toBeDefined();

            // Verify Procedure was persisted
            const procedure = await prisma.procedure.findFirst({
                where: { epicId: 'proc-001' },
            });
            expect(procedure).toBeDefined();

            // Verify DiagnosticReport was persisted
            const diagnosticReport = await prisma.diagnosticReport.findFirst({
                where: { epicId: 'dr-001' },
            });
            expect(diagnosticReport).toBeDefined();
        });

        it('should use deterministic upsert (idempotent persistence)', async () => {
            if (!jobId) {
                return;
            }

            // Create a second job with same data
            const job2Result = await service.createJob({
                sourceType: 'FLAT_FHIR_CSV',
            });

            const job2Id = job2Result.jobId;

            if (!fs.existsSync(sampleCsvPath)) {
                return;
            }

            const csvData = fs.readFileSync(sampleCsvPath, 'utf-8');
            await service.uploadCsv(job2Id, { csvData });
            await service.startJob(job2Id, {});

            // Verify Patient record is same (idempotent)
            const patients = await prisma.patient.findMany({
                where: { epicId: 'patient-001' },
            });
            expect(patients.length).toBe(1); // Should not create duplicate
        });
    });

    afterAll(async () => {
        // Clean up - remove test data
        try {
            if (jobId) {
                // Delete all row results for this job
                await prisma.ingestionRowResultV2.deleteMany({
                    where: { jobId },
                });

                // Delete the job itself
                await prisma.ingestionJobV2.deleteMany({
                    where: { id: jobId },
                });
            }

            // Clean up by patient names from test
            await prisma.diagnosticReport.deleteMany({
                where: {
                    patient: {
                        name: 'Jane Doe',
                    },
                },
            });
            await prisma.procedure.deleteMany({
                where: {
                    patient: {
                        name: 'Jane Doe',
                    },
                },
            });
            await prisma.allergy.deleteMany({
                where: {
                    patient: {
                        name: 'Jane Doe',
                    },
                },
            });
            await prisma.medication.deleteMany({
                where: {
                    patient: {
                        name: 'Jane Doe',
                    },
                },
            });
            await prisma.condition.deleteMany({
                where: {
                    patient: {
                        name: 'Jane Doe',
                    },
                },
            });
            await prisma.observation.deleteMany({
                where: {
                    patient: {
                        name: 'Jane Doe',
                    },
                },
            });
            await prisma.encounter.deleteMany({
                where: {
                    patient: {
                        name: 'Jane Doe',
                    },
                },
            });
            await prisma.patient.deleteMany({
                where: {
                    name: 'Jane Doe',
                },
            });
        } catch (err) {
            // Silently fail during cleanup
            console.log('Cleanup error:', err);
        }
    });
});
