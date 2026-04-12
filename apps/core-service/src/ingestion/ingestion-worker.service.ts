import {
    db,
    encounters,
    ingestionJobs,
    ingestionRowResults,
    patients,
} from '@app/db';
import { Injectable, Logger } from '@nestjs/common';
import { and, asc, count, eq } from 'drizzle-orm';

@Injectable()
export class IngestionWorkerService {
    private readonly logger = new Logger(IngestionWorkerService.name);

    private readonly progressMap = new Map<
        string,
        { total: number; processed: number; status: string }
    >();

    getProgress(jobId: string) {
        return (
            this.progressMap.get(jobId) ?? {
                total: 0,
                processed: 0,
                status: 'UNKNOWN',
            }
        );
    }

    async processQueuedJob(jobId: string, organizationId: string): Promise<void> {
        this.logger.log(`Worker picked ingestion job ${jobId}`);

        const [job] = await db
            .select()
            .from(ingestionJobs)
            .where(
                and(
                    eq(ingestionJobs.id, jobId),
                    eq(ingestionJobs.organizationId, organizationId),
                ),
            )
            .limit(1);

        if (!job) {
            throw new Error(
                `Ingestion job ${jobId} not found for organization ${organizationId}`,
            );
        }

        const rows = await db
            .select({
                id: ingestionRowResults.id,
                rowNumber: ingestionRowResults.rowNumber,
                outcome: ingestionRowResults.outcome,
                rowData: ingestionRowResults.rowData,
                entityType: ingestionRowResults.entityType,
            })
            .from(ingestionRowResults)
            .where(
                and(
                    eq(ingestionRowResults.jobId, jobId),
                    eq(ingestionRowResults.organizationId, organizationId),
                ),
            )
            .orderBy(asc(ingestionRowResults.rowNumber));

        const total = rows.length;
        let processed = 0;
        const runtimeErrorSummary: Record<string, number> = {};
        const persistenceCounters = {
            patientsInserted: 0,
            patientsUpdated: 0,
            encountersInserted: 0,
            encountersUpdated: 0,
        };

        this.progressMap.set(jobId, { total, processed, status: 'RUNNING' });

        try {
            for (const row of rows) {
                if (row.outcome !== 'ERROR') {
                    try {
                        const materialized = await this.materializeRow(
                            row.rowData,
                            organizationId,
                            persistenceCounters,
                        );

                        await db
                            .update(ingestionRowResults)
                            .set({
                                outcome: materialized.outcome,
                                reasonCode: null,
                                message: materialized.message,
                                persisted: materialized.persisted,
                            })
                            .where(eq(ingestionRowResults.id, row.id));
                    } catch (error: unknown) {
                        const errorMessage =
                            error instanceof Error
                                ? error.message
                                : 'Unknown persistence error';
                        runtimeErrorSummary.PERSIST_ERROR =
                            (runtimeErrorSummary.PERSIST_ERROR ?? 0) + 1;

                        await db
                            .update(ingestionRowResults)
                            .set({
                                outcome: 'ERROR',
                                reasonCode: 'PERSIST_ERROR',
                                message: errorMessage,
                                persisted: null,
                            })
                            .where(eq(ingestionRowResults.id, row.id));
                    }
                }

                processed += 1;
                if (processed % 25 === 0 || processed === total) {
                    await db
                        .update(ingestionJobs)
                        .set({ processedRows: processed, updatedAt: new Date() })
                        .where(
                            and(
                                eq(ingestionJobs.id, jobId),
                                eq(ingestionJobs.organizationId, organizationId),
                            ),
                        );
                }

                this.progressMap.set(jobId, { total, processed, status: 'RUNNING' });
            }

            const [{ failedRows }] = await db
                .select({ failedRows: count() })
                .from(ingestionRowResults)
                .where(
                    and(
                        eq(ingestionRowResults.jobId, jobId),
                        eq(ingestionRowResults.organizationId, organizationId),
                        eq(ingestionRowResults.outcome, 'ERROR'),
                    ),
                );

            const [{ totalRows }] = await db
                .select({ totalRows: count() })
                .from(ingestionRowResults)
                .where(
                    and(
                        eq(ingestionRowResults.jobId, jobId),
                        eq(ingestionRowResults.organizationId, organizationId),
                    ),
                );

            const parsedTotalRows = Number(totalRows ?? 0);
            const parsedFailedRows = Number(failedRows ?? 0);
            const successRows = parsedTotalRows - parsedFailedRows;

            const persistedErrorSummary =
                job.errorSummary && typeof job.errorSummary === 'object'
                    ? (job.errorSummary as Record<string, number>)
                    : {};

            for (const [code, countValue] of Object.entries(runtimeErrorSummary)) {
                persistedErrorSummary[code] =
                    (persistedErrorSummary[code] ?? 0) + countValue;
            }
            persistedErrorSummary.PATIENT_INSERTED =
                persistenceCounters.patientsInserted;
            persistedErrorSummary.PATIENT_UPDATED =
                persistenceCounters.patientsUpdated;
            persistedErrorSummary.ENCOUNTER_INSERTED =
                persistenceCounters.encountersInserted;
            persistedErrorSummary.ENCOUNTER_UPDATED =
                persistenceCounters.encountersUpdated;

            await db
                .update(ingestionJobs)
                .set({
                    status: 'COMPLETED',
                    processedRows: parsedTotalRows,
                    totalRows: parsedTotalRows,
                    successRows,
                    failedRows: parsedFailedRows,
                    errorSummary: persistedErrorSummary,
                    completedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(ingestionJobs.id, jobId),
                        eq(ingestionJobs.organizationId, organizationId),
                    ),
                );

            this.progressMap.set(jobId, {
                total: parsedTotalRows,
                processed: parsedTotalRows,
                status: 'COMPLETED',
            });
            this.logger.log(`Worker completed ingestion job ${jobId}`);
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown worker failure';

            await db
                .update(ingestionJobs)
                .set({
                    status: 'FAILED',
                    errorSummary: { workerError: errorMessage },
                    completedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(ingestionJobs.id, jobId),
                        eq(ingestionJobs.organizationId, organizationId),
                    ),
                );

            this.progressMap.set(jobId, { total, processed, status: 'FAILED' });
            this.logger.error(
                `Worker failed ingestion job ${jobId}: ${errorMessage}`,
            );
            throw error;
        }
    }

    private async materializeRow(
        rowData: unknown,
        organizationId: string,
        persistenceCounters: {
            patientsInserted: number;
            patientsUpdated: number;
            encountersInserted: number;
            encountersUpdated: number;
        },
    ): Promise<{
        outcome: 'INSERTED' | 'UPDATED';
        message: string;
        persisted: Record<string, unknown>;
    }> {
        const normalized = this.normalizeRowData(rowData);
        const patientSourceId = this.pickSourceId(normalized, [
            'patient_epic_id',
            'patient_id',
            'patientepicid',
            'patientid',
        ]);

        if (!patientSourceId) {
            throw new Error('Missing patient source identifier in row payload.');
        }

        const [existingPatient] = await db
            .select({ id: patients.id })
            .from(patients)
            .where(
                and(
                    eq(patients.organizationId, organizationId),
                    eq(patients.sourceId, patientSourceId),
                ),
            )
            .limit(1);

        const [upsertedPatient] = await db
            .insert(patients)
            .values({
                organizationId,
                sourceId: patientSourceId,
                name: this.buildPatientName(normalized),
                gender: this.pickFirst(normalized, ['gender', 'patient_gender']),
                birthDate: this.parseDate(
                    this.pickFirst(normalized, [
                        'birth_date',
                        'patient_dob',
                        'patient_birth_date',
                    ]),
                ),
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: [patients.organizationId, patients.sourceId],
                set: {
                    name: this.buildPatientName(normalized),
                    gender: this.pickFirst(normalized, ['gender', 'patient_gender']),
                    birthDate: this.parseDate(
                        this.pickFirst(normalized, [
                            'birth_date',
                            'patient_dob',
                            'patient_birth_date',
                        ]),
                    ),
                    updatedAt: new Date(),
                },
            })
            .returning({ id: patients.id });

        const patientAction = existingPatient ? 'UPDATED' : 'INSERTED';
        if (patientAction === 'INSERTED') {
            persistenceCounters.patientsInserted += 1;
        } else {
            persistenceCounters.patientsUpdated += 1;
        }

        const encounterSourceId = this.pickSourceId(normalized, [
            'encounter_epic_id',
            'encounter_id',
            'encounterid',
        ]);

        let encounterAction: 'INSERTED' | 'UPDATED' | null = null;
        let encounterId: string | null = null;

        if (encounterSourceId) {
            const [existingEncounter] = await db
                .select({ id: encounters.id })
                .from(encounters)
                .where(
                    and(
                        eq(encounters.organizationId, organizationId),
                        eq(encounters.sourceId, encounterSourceId),
                    ),
                )
                .limit(1);

            const [upsertedEncounter] = await db
                .insert(encounters)
                .values({
                    organizationId,
                    sourceId: encounterSourceId,
                    patientId: upsertedPatient.id,
                    status: this.pickFirst(normalized, ['encounter_status', 'status']),
                    type: this.buildEncounterType(normalized),
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [encounters.organizationId, encounters.sourceId],
                    set: {
                        patientId: upsertedPatient.id,
                        status: this.pickFirst(normalized, ['encounter_status', 'status']),
                        type: this.buildEncounterType(normalized),
                        updatedAt: new Date(),
                    },
                })
                .returning({ id: encounters.id });

            encounterAction = existingEncounter ? 'UPDATED' : 'INSERTED';
            encounterId = upsertedEncounter.id;
            if (encounterAction === 'INSERTED') {
                persistenceCounters.encountersInserted += 1;
            } else {
                persistenceCounters.encountersUpdated += 1;
            }
        }

        const rowOutcome =
            patientAction === 'UPDATED' || encounterAction === 'UPDATED'
                ? 'UPDATED'
                : 'INSERTED';

        return {
            outcome: rowOutcome,
            message: encounterAction
                ? `Patient ${patientAction.toLowerCase()} and encounter ${encounterAction.toLowerCase()} successfully`
                : `Patient ${patientAction.toLowerCase()} successfully`,
            persisted: {
                status: 'PERSISTED',
                persistedAt: new Date().toISOString(),
                patient: {
                    id: upsertedPatient.id,
                    action: patientAction,
                    sourceId: patientSourceId,
                },
                encounter: encounterAction
                    ? {
                        id: encounterId,
                        action: encounterAction,
                        sourceId: encounterSourceId,
                    }
                    : null,
            },
        };
    }

    private normalizeRowData(rowData: unknown): Record<string, string | null> {
        if (!rowData || typeof rowData !== 'object' || Array.isArray(rowData)) {
            throw new Error('Row payload is not a valid object.');
        }

        const normalized: Record<string, string | null> = {};
        for (const [key, value] of Object.entries(
            rowData as Record<string, unknown>,
        )) {
            if (value === null || value === undefined) {
                normalized[key] = null;
                continue;
            }
            normalized[key] =
                typeof value === 'string' ? value.trim() : JSON.stringify(value);
        }

        return normalized;
    }

    private pickSourceId(
        row: Record<string, string | null>,
        keys: string[],
    ): string | null {
        for (const key of keys) {
            const value = row[key];
            if (typeof value === 'string' && value.length > 0) {
                return value;
            }
        }
        return null;
    }

    private pickFirst(
        row: Record<string, string | null>,
        keys: string[],
    ): string | null {
        for (const key of keys) {
            const value = row[key];
            if (typeof value === 'string' && value.length > 0) {
                return value;
            }
        }
        return null;
    }

    private parseDate(value: string | null): Date | null {
        if (!value) {
            return null;
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }
        return parsed;
    }

    private buildPatientName(row: Record<string, string | null>): unknown {
        const displayName = this.pickFirst(row, ['patient_name', 'name']);
        const firstName = this.pickFirst(row, ['patient_first_name', 'first_name']);
        const lastName = this.pickFirst(row, ['patient_last_name', 'last_name']);

        if (!displayName && !firstName && !lastName) {
            return null;
        }

        if (displayName) {
            return [{ text: displayName }];
        }

        return [{ given: firstName ? [firstName] : [], family: lastName ?? '' }];
    }

    private buildEncounterType(row: Record<string, string | null>): unknown {
        const encounterType = this.pickFirst(row, [
            'encounter_type',
            'encounter_class',
        ]);
        if (!encounterType) {
            return null;
        }

        return [{ text: encounterType }];
    }
}
