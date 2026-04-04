import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { RiskEngineService } from '../../risk-engine/risk-engine.service';
import { PrismaService } from '../../server/prisma.service';
import { parseCsvRows } from './csv';
import { normalizeDateValue } from './date-normalizer';
import { normalizeRowToEntities } from './entity-normalizer';
import {
    createJobRequestSchema,
    DateColumnRule,
    MappingManifest,
    normalizedCsvRowSchema,
    RowResult,
    rowResultSchema,
    startJobRequestSchema,
    uploadCsvRequestSchema,
} from './schemas';

type IngestionV2PrismaAdapter = PrismaService & {
    ingestionJobV2: {
        create: (...args: any[]) => Promise<any>;
        findUnique: (...args: any[]) => Promise<any>;
        update: (...args: any[]) => Promise<any>;
    };
    ingestionRowResultV2: {
        deleteMany: (...args: any[]) => Promise<any>;
        createMany: (...args: any[]) => Promise<any>;
        count: (...args: any[]) => Promise<number>;
        findMany: (...args: any[]) => Promise<any[]>;
    };
    patient: {
        upsert: (...args: any[]) => Promise<any>;
    };
    practitioner: {
        upsert: (...args: any[]) => Promise<any>;
    };
    encounter: {
        upsert: (...args: any[]) => Promise<any>;
    };
    observation: {
        upsert: (...args: any[]) => Promise<any>;
    };
    condition: {
        upsert: (...args: any[]) => Promise<any>;
    };
    medication: {
        upsert: (...args: any[]) => Promise<any>;
    };
    allergy: {
        upsert: (...args: any[]) => Promise<any>;
    };
    procedure: {
        upsert: (...args: any[]) => Promise<any>;
    };
    diagnosticReport: {
        upsert: (...args: any[]) => Promise<any>;
    };
};

const DEFAULT_MAPPING_MANIFEST: MappingManifest = {
    schemaVersion: '1.0.0',
    family: 'FLAT_FHIR_CSV',
    dateColumns: {
        birth_date: {
            acceptedFormats: ['ISO_8601', 'YYYY_MM_DD', 'MM_DD_YYYY', 'DD_MM_YYYY'],
            outputType: 'date',
            timezone: 'UTC',
            nullable: true,
        },
        date_of_birth: {
            acceptedFormats: ['ISO_8601', 'YYYY_MM_DD', 'MM_DD_YYYY', 'DD_MM_YYYY'],
            outputType: 'date',
            timezone: 'UTC',
            nullable: true,
        },
        onset_date: {
            acceptedFormats: ['ISO_8601', 'YYYY_MM_DD', 'MM_DD_YYYY', 'DD_MM_YYYY'],
            outputType: 'date',
            timezone: 'UTC',
            nullable: true,
        },
        recorded_date: {
            acceptedFormats: ['ISO_8601', 'YYYY_MM_DD', 'MM_DD_YYYY', 'DD_MM_YYYY'],
            outputType: 'date',
            timezone: 'UTC',
            nullable: true,
        },
        start_date: {
            acceptedFormats: ['ISO_8601', 'YYYY_MM_DD', 'MM_DD_YYYY', 'DD_MM_YYYY'],
            outputType: 'datetime',
            timezone: 'UTC',
            nullable: true,
        },
        end_date: {
            acceptedFormats: ['ISO_8601', 'YYYY_MM_DD', 'MM_DD_YYYY', 'DD_MM_YYYY'],
            outputType: 'datetime',
            timezone: 'UTC',
            nullable: true,
        },
        effective_date: {
            acceptedFormats: ['ISO_8601', 'YYYY_MM_DD', 'MM_DD_YYYY', 'DD_MM_YYYY'],
            outputType: 'datetime',
            timezone: 'UTC',
            nullable: true,
        },
        issued_date: {
            acceptedFormats: ['ISO_8601', 'YYYY_MM_DD', 'MM_DD_YYYY', 'DD_MM_YYYY'],
            outputType: 'datetime',
            timezone: 'UTC',
            nullable: true,
        },
        note_signed_date: {
            acceptedFormats: ['ISO_8601', 'YYYY_MM_DD', 'MM_DD_YYYY', 'DD_MM_YYYY'],
            outputType: 'datetime',
            timezone: 'UTC',
            nullable: true,
        },
    },
};

@Injectable()
export class IngestionV2Service {
    private readonly logger = new Logger(IngestionV2Service.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly riskEngineService: RiskEngineService,
    ) { }

    private get prismaV2(): IngestionV2PrismaAdapter {
        return this.prisma as IngestionV2PrismaAdapter;
    }

    async createJob(rawInput: unknown) {
        const input = createJobRequestSchema.parse(rawInput);
        const manifest = input.mappingManifest ?? DEFAULT_MAPPING_MANIFEST;

        const manifestJson = manifest as unknown as Prisma.InputJsonValue;

        const created = await this.prismaV2.ingestionJobV2.create({
            data: {
                sourceType: input.sourceType,
                templateVersion: input.templateVersion,
                status: 'CREATED',
                mappingManifest: manifestJson,
            },
        });

        return {
            jobId: created.id,
            status: created.status,
            sourceType: created.sourceType,
            createdAt: created.createdAt,
        };
    }

    async uploadCsv(jobId: string, rawInput: unknown) {
        const input = uploadCsvRequestSchema.parse(rawInput);
        const job = await this.prismaV2.ingestionJobV2.findFirst({
            where: { id: jobId },
        });

        if (!job) {
            throw new NotFoundException(`Ingestion job not found: ${jobId}`);
        }

        if (job.status !== 'CREATED' && job.status !== 'UPLOADED') {
            throw new BadRequestException(
                `Cannot upload CSV while job is in status ${job.status}. Expected CREATED or UPLOADED.`,
            );
        }

        const checksumSha256 = createHash('sha256').update(input.csvData).digest('hex');

        const parsedRows = parseCsvRows(input.csvData);
        if (parsedRows.length === 0) {
            throw new BadRequestException('CSV payload has no data rows');
        }

        const manifest = this.resolveManifest(job.mappingManifest);

        const rowResults = parsedRows.map((rawRow, idx) =>
            this.validateAndNormalizeRow({
                row: rawRow,
                rowNumber: idx + 1,
                manifest,
            }),
        );

        const summary = this.summarizeResults(rowResults);

        await this.prisma.$transaction(async (tx) => {
            await tx.ingestionRowResultV2.deleteMany({ where: { jobId } });
            await tx.ingestionJobV2.update({
                where: { id: jobId },
                data: {
                    status: 'UPLOADED',
                    checksumSha256,
                    totalRows: summary.totalRows,
                    processedRows: summary.totalRows,
                    successRows: summary.successRows,
                    failedRows: summary.failedRows,
                    errorSummary: summary.errorSummary as unknown as Prisma.InputJsonValue,
                },
            });
            await tx.ingestionRowResultV2.createMany({
                data: rowResults.map((result, idx) => ({
                    jobId,
                    rowNumber: result.rowNumber,
                    sourceRecordKey: result.sourceRecordKey,
                    entityType: result.entityType,
                    outcome: result.outcome,
                    reasonCode: result.reasonCode,
                    message: result.message,
                    rowData: parsedRows[idx] as unknown as Prisma.InputJsonValue,
                })),
            });
        });

        return {
            jobId,
            status: 'UPLOADED',
            checksumSha256,
            ...summary,
        };
    }

    async startJob(jobId: string, rawInput: unknown) {
        const payload = startJobRequestSchema.parse(rawInput ?? {});
        void payload;

        const job = await this.prismaV2.ingestionJobV2.findFirst({
            where: { id: jobId },
        });
        if (!job) {
            throw new NotFoundException(`Ingestion job not found: ${jobId}`);
        }

        if (job.status !== 'UPLOADED') {
            throw new BadRequestException(`Job must be UPLOADED before start. Current status: ${job.status}`);
        }

        // Transition to RUNNING
        await this.prismaV2.ingestionJobV2.update({
            where: { id: jobId },
            data: {
                status: 'RUNNING',
                startedAt: new Date(),
            },
        });

        // Fetch all row results for this job
        const rowResults = await this.prismaV2.ingestionRowResultV2.findMany({
            where: { jobId },
            orderBy: { rowNumber: 'asc' },
        });

        // Process rows with successful outcomes
        const successfulRows = rowResults.filter((r) => r.outcome === 'INSERTED');
        let persistedCount = 0;
        let persistedErrors: { rowNumber: number; error: string }[] = [];
        const persistedPatientIds = new Set<string>();

        for (const rowResult of successfulRows) {
            const row = (rowResult as any).rowData as Record<string, any>;
            if (!row) {
                continue;
            }

            try {
                // Normalize entities from row
                const normResult = normalizeRowToEntities(row);
                if (!normResult.success || !normResult.entities) {
                    persistedErrors.push({
                        rowNumber: rowResult.rowNumber,
                        error: normResult.errors?.[0] || 'Unknown entity normalization error',
                    });
                    continue;
                }

                const entities = normResult.entities;
                const persistedIds: Record<string, string> = {};

                // Persist Patient (required)
                if (entities.patient) {
                    const patient = await this.prismaV2.patient.upsert({
                        where: { epicId: entities.patient.epicId as string },
                        update: entities.patient as any,
                        create: entities.patient as any,
                    });
                    persistedIds.patientId = patient.id;
                    persistedPatientIds.add(patient.id);
                }

                // Persist Practitioner (optional)
                if (entities.practitioner) {
                    const practitioner = await this.prismaV2.practitioner.upsert({
                        where: { epicId: entities.practitioner.epicId as string },
                        update: entities.practitioner as any,
                        create: entities.practitioner as any,
                    });
                    persistedIds.practitionerId = practitioner.id;
                }

                // Persist related entities (all require patientId)
                const patientId = persistedIds.patientId;

                if (entities.encounter && patientId) {
                    const encounter = await this.prismaV2.encounter.upsert({
                        where: { epicId: entities.encounter.epicId as string },
                        update: {
                            ...entities.encounter,
                            patient: { connect: { id: patientId } },
                        } as any,
                        create: {
                            ...entities.encounter,
                            patient: { connect: { id: patientId } },
                        } as any,
                    });
                    persistedIds.encounterId = encounter.id;
                }

                if (entities.observation && patientId) {
                    const observation = await this.prismaV2.observation.upsert({
                        where: { epicId: entities.observation.epicId as string },
                        update: {
                            ...entities.observation,
                            patient: { connect: { id: patientId } },
                        } as any,
                        create: {
                            ...entities.observation,
                            patient: { connect: { id: patientId } },
                        } as any,
                    });
                    persistedIds.observationId = observation.id;
                }

                if (entities.condition && patientId) {
                    const condition = await this.prismaV2.condition.upsert({
                        where: { epicId: entities.condition.epicId as string },
                        update: {
                            ...entities.condition,
                            patient: { connect: { id: patientId } },
                        } as any,
                        create: {
                            ...entities.condition,
                            patient: { connect: { id: patientId } },
                        } as any,
                    });
                    persistedIds.conditionId = condition.id;
                }

                if (entities.medication && patientId) {
                    const medication = await this.prismaV2.medication.upsert({
                        where: { epicId: entities.medication.epicId as string },
                        update: {
                            ...entities.medication,
                            patient: { connect: { id: patientId } },
                        } as any,
                        create: {
                            ...entities.medication,
                            patient: { connect: { id: patientId } },
                        } as any,
                    });
                    persistedIds.medicationId = medication.id;
                }

                if (entities.allergy && patientId) {
                    const allergy = await this.prismaV2.allergy.upsert({
                        where: { epicId: entities.allergy.epicId as string },
                        update: {
                            ...entities.allergy,
                            patient: { connect: { id: patientId } },
                        } as any,
                        create: {
                            ...entities.allergy,
                            patient: { connect: { id: patientId } },
                        } as any,
                    });
                    persistedIds.allergyId = allergy.id;
                }

                if (entities.procedure && patientId) {
                    const procedure = await this.prismaV2.procedure.upsert({
                        where: { epicId: entities.procedure.epicId as string },
                        update: {
                            ...entities.procedure,
                            patient: { connect: { id: patientId } },
                        } as any,
                        create: {
                            ...entities.procedure,
                            patient: { connect: { id: patientId } },
                        } as any,
                    });
                    persistedIds.procedureId = procedure.id;
                }

                if (entities.diagnosticReport && patientId) {
                    const diagnosticReport = await this.prismaV2.diagnosticReport.upsert({
                        where: { epicId: entities.diagnosticReport.epicId as string },
                        update: {
                            ...entities.diagnosticReport,
                            patient: { connect: { id: patientId } },
                        } as any,
                        create: {
                            ...entities.diagnosticReport,
                            patient: { connect: { id: patientId } },
                        } as any,
                    });
                    persistedIds.diagnosticReportId = diagnosticReport.id;
                }

                // Update row result with persisted IDs (skip this for now - field doesn't exist yet)
                // await this.prisma.ingestionRowResultV2.update({
                //   where: { id: rowResult.id },
                //   data: {
                //     persisted: persistedIds as unknown as Prisma.InputJsonValue,
                //   },
                // });

                persistedCount++;
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                persistedErrors.push({
                    rowNumber: rowResult.rowNumber,
                    error: `Entity persistence failed: ${message}`,
                });
                this.logger.error(
                    `Failed to persist entities for row ${rowResult.rowNumber}: ${message}`,
                );
            }
        }

        // Transition to COMPLETED
        const completed = await this.prismaV2.ingestionJobV2.update({
            where: { id: jobId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
            },
        });

        this.logger.log(
            `Ingestion v2 job completed: ${jobId} (persisted ${persistedCount}/${successfulRows.length} entities)`,
        );

        // Evaluate risk for each unique persisted patient
        const riskEvaluations: any[] = [];
        for (const patientId of persistedPatientIds) {
            try {
                const riskResult = await this.riskEngineService.evaluatePatientRules(patientId);
                riskEvaluations.push(riskResult);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                this.logger.warn(
                    `Risk evaluation failed for patient ${patientId}: ${message}`,
                );
            }
        }

        return {
            jobId: completed.id,
            status: completed.status,
            totalRows: completed.totalRows,
            successRows: completed.successRows,
            failedRows: completed.failedRows,
            persistedCount,
            persistedErrors: persistedErrors.length > 0 ? persistedErrors : undefined,
            riskEvaluations: riskEvaluations.length > 0 ? riskEvaluations : undefined,
            startedAt: completed.startedAt,
            completedAt: completed.completedAt,
        };
    }

    async getJobStatus(jobId: string) {
        const job = await this.prismaV2.ingestionJobV2.findFirst({
            where: { id: jobId },
        });

        if (!job) {
            throw new NotFoundException(`Ingestion job not found: ${jobId}`);
        }

        return job;
    }

    async getRowResults(jobId: string, page = 1, pageSize = 50) {
        const job = await this.prismaV2.ingestionJobV2.findFirst({
            where: { id: jobId },
            select: { id: true },
        });

        if (!job) {
            throw new NotFoundException(`Ingestion job not found: ${jobId}`);
        }

        const safePage = Math.max(1, page);
        const safePageSize = Math.min(500, Math.max(1, pageSize));
        const skip = (safePage - 1) * safePageSize;

        const [total, rows] = await this.prisma.$transaction(async (tx) => {
            const count = await tx.ingestionRowResultV2.count({ where: { jobId } });
            const data = await tx.ingestionRowResultV2.findMany({
                where: { jobId },
                skip,
                take: safePageSize,
                orderBy: { rowNumber: 'asc' },
            });

            return [count, data] as const;
        });

        return {
            page: safePage,
            pageSize: safePageSize,
            total,
            rows,
        };
    }

    private resolveManifest(rawManifest: Prisma.JsonValue | null): MappingManifest {
        if (!rawManifest) {
            return DEFAULT_MAPPING_MANIFEST;
        }

        return this.safeManifestParse(rawManifest);
    }

    private safeManifestParse(rawManifest: Prisma.JsonValue): MappingManifest {
        try {
            return MappingManifestSchemaParser.parse(rawManifest);
        } catch (error) {
            this.logger.warn('Invalid mapping manifest in job. Falling back to defaults.');
            void error;
            return DEFAULT_MAPPING_MANIFEST;
        }
    }

    private validateAndNormalizeRow(args: {
        row: Record<string, string | null>;
        rowNumber: number;
        manifest: MappingManifest;
    }) {
        const { row, rowNumber, manifest } = args;

        const rowValidation = normalizedCsvRowSchema.safeParse(row);
        if (!rowValidation.success) {
            const parsed = rowResultSchema.parse({
                rowNumber,
                outcome: 'ERROR',
                reasonCode: 'INVALID_ROW',
                message: rowValidation.error.issues[0]?.message ?? 'Row validation failed',
            });
            return parsed;
        }

        const normalizedRow = { ...rowValidation.data };

        const dateColumns = manifest.dateColumns as Record<string, DateColumnRule>;

        for (const [column, rule] of Object.entries(dateColumns)) {
            const rawValue = normalizedRow[column];
            if (rawValue === undefined && rule.nullable) {
                continue;
            }

            const normalized = normalizeDateValue(rawValue, rule as DateColumnRule);
            if (!normalized.success) {
                return rowResultSchema.parse({
                    rowNumber,
                    sourceRecordKey: this.resolveSourceRecordKey(normalizedRow),
                    outcome: 'ERROR',
                    reasonCode: normalized.code,
                    message: `${column}: ${normalized.message}`,
                });
            }

            normalizedRow[column] = normalized.normalized || null;
        }

        return rowResultSchema.parse({
            rowNumber,
            sourceRecordKey: this.resolveSourceRecordKey(normalizedRow),
            entityType: 'flat_fhir_row',
            outcome: 'INSERTED',
            message: 'Row validated and normalized',
        });
    }

    private resolveSourceRecordKey(row: Record<string, string | null>): string | undefined {
        const candidates = ['epicid', 'record_id', 'source_record_id'];

        for (const key of candidates) {
            const value = row[key];
            if (typeof value === 'string' && value.trim().length > 0) {
                return value;
            }
        }

        return undefined;
    }

    private summarizeResults(rowResults: RowResult[]) {
        const summary = {
            totalRows: rowResults.length,
            successRows: rowResults.filter((r) => r.outcome !== 'ERROR').length,
            failedRows: rowResults.filter((r) => r.outcome === 'ERROR').length,
            errorSummary: {} as Record<string, number>,
        };

        for (const row of rowResults) {
            if (row.outcome !== 'ERROR' || !row.reasonCode) {
                continue;
            }

            summary.errorSummary[row.reasonCode] =
                (summary.errorSummary[row.reasonCode] ?? 0) + 1;
        }

        return summary;
    }
}

const MappingManifestSchemaParser = {
    parse(input: Prisma.JsonValue): MappingManifest {
        return createJobRequestSchema.shape.mappingManifest.unwrap().parse(input);
    },
};
