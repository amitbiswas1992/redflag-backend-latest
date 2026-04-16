import {
    allergies,
    auditLogs,
    complianceFlags,
    conditions,
    db,
    diagnosticReports,
    encounterAnalytics,
    encounters,
    ingestionJobs,
    ingestionRowResults,
    ingestionStats,
    medicationAnalytics,
    medications,
    observations,
    patients,
    practitioners,
    procedures,
    rawFhirIngestions,
    riskScores,
    substances,
} from '@app/db';
import { Injectable, Logger } from '@nestjs/common';
import { and, asc, count, eq, inArray } from 'drizzle-orm';

type PersistenceCounters = {
    patientsInserted: number;
    patientsUpdated: number;
    practitionersInserted: number;
    practitionersUpdated: number;
    encountersInserted: number;
    encountersUpdated: number;
    observationsInserted: number;
    observationsUpdated: number;
    conditionsInserted: number;
    conditionsUpdated: number;
    medicationsInserted: number;
    medicationsUpdated: number;
    substancesInserted: number;
    substancesUpdated: number;
    allergiesInserted: number;
    allergiesUpdated: number;
    proceduresInserted: number;
    proceduresUpdated: number;
    diagnosticReportsInserted: number;
    diagnosticReportsUpdated: number;
    encounterAnalyticsInserted: number;
    encounterAnalyticsUpdated: number;
    medicationAnalyticsInserted: number;
    medicationAnalyticsUpdated: number;
    complianceFlagsInserted: number;
    riskScoresInserted: number;
    auditLogsInserted: number;
};

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
        const expectedEncounterProjectionIds = new Set<string>();
        const expectedMedicationProjectionIds = new Set<string>();
        const runtimeErrorSummary: Record<string, number> = {};
        const uniquePatientSourceIds = new Set<string>();
        const persistenceCounters = {
            patientsInserted: 0,
            patientsUpdated: 0,
            practitionersInserted: 0,
            practitionersUpdated: 0,
            encountersInserted: 0,
            encountersUpdated: 0,
            observationsInserted: 0,
            observationsUpdated: 0,
            conditionsInserted: 0,
            conditionsUpdated: 0,
            medicationsInserted: 0,
            medicationsUpdated: 0,
            substancesInserted: 0,
            substancesUpdated: 0,
            allergiesInserted: 0,
            allergiesUpdated: 0,
            proceduresInserted: 0,
            proceduresUpdated: 0,
            diagnosticReportsInserted: 0,
            diagnosticReportsUpdated: 0,
            encounterAnalyticsInserted: 0,
            encounterAnalyticsUpdated: 0,
            medicationAnalyticsInserted: 0,
            medicationAnalyticsUpdated: 0,
            complianceFlagsInserted: 0,
            riskScoresInserted: 0,
            auditLogsInserted: 0,
        };

        this.progressMap.set(jobId, { total, processed, status: 'RUNNING' });

        try {
            const batchSize = 500;

            for (let batchStart = 0; batchStart < rows.length; batchStart += batchSize) {
                const rowBatch = rows.slice(batchStart, batchStart + batchSize);

                for (const row of rowBatch) {
                    if (row.outcome !== 'ERROR') {
                        try {
                            const materialized = await this.materializeRow(
                                row.rowData,
                                organizationId,
                                persistenceCounters,
                            );

                            const persistedPatient = materialized.persisted.patient as
                                | Record<string, unknown>
                                | undefined;
                            const persistedPatientSourceId = persistedPatient?.sourceId;
                            if (typeof persistedPatientSourceId === 'string') {
                                uniquePatientSourceIds.add(persistedPatientSourceId);
                            }

                            const persistedEncounter =
                                (materialized.persisted.encounter as Record<string, unknown> | undefined)
                                    ?.id;
                            const persistedMedication =
                                (materialized.persisted.medication as Record<string, unknown> | undefined)
                                    ?.id;

                            if (typeof persistedEncounter === 'string') {
                                expectedEncounterProjectionIds.add(persistedEncounter);
                            }

                            if (typeof persistedMedication === 'string') {
                                expectedMedicationProjectionIds.add(persistedMedication);
                            }

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

            const [{ rawRows }] = await db
                .select({ rawRows: count() })
                .from(rawFhirIngestions)
                .where(
                    and(
                        eq(rawFhirIngestions.jobId, jobId),
                        eq(rawFhirIngestions.organizationId, organizationId),
                    ),
                );

            const parsedRawRows = Number(rawRows ?? 0);
            if (parsedRawRows !== parsedTotalRows) {
                persistedErrorSummary.RAW_ROW_COUNT_MISMATCH =
                    Math.abs(parsedRawRows - parsedTotalRows);
            }

            if (expectedEncounterProjectionIds.size > 0) {
                const [{ availableEncounterProjections }] = await db
                    .select({ availableEncounterProjections: count() })
                    .from(encounterAnalytics)
                    .where(
                        and(
                            eq(encounterAnalytics.organizationId, organizationId),
                            inArray(
                                encounterAnalytics.encounterId,
                                Array.from(expectedEncounterProjectionIds),
                            ),
                        ),
                    );

                const projectionGap =
                    expectedEncounterProjectionIds.size -
                    Number(availableEncounterProjections ?? 0);
                if (projectionGap > 0) {
                    persistedErrorSummary.ENCOUNTER_ANALYTICS_MISSING = projectionGap;
                }
            }

            if (expectedMedicationProjectionIds.size > 0) {
                const [{ availableMedicationProjections }] = await db
                    .select({ availableMedicationProjections: count() })
                    .from(medicationAnalytics)
                    .where(
                        and(
                            eq(medicationAnalytics.organizationId, organizationId),
                            inArray(
                                medicationAnalytics.medicationId,
                                Array.from(expectedMedicationProjectionIds),
                            ),
                        ),
                    );

                const projectionGap =
                    expectedMedicationProjectionIds.size -
                    Number(availableMedicationProjections ?? 0);
                if (projectionGap > 0) {
                    persistedErrorSummary.MEDICATION_ANALYTICS_MISSING = projectionGap;
                }
            }

            for (const [code, countValue] of Object.entries(runtimeErrorSummary)) {
                persistedErrorSummary[code] =
                    (persistedErrorSummary[code] ?? 0) + countValue;
            }
            persistedErrorSummary.PATIENT_INSERTED =
                persistenceCounters.patientsInserted;
            persistedErrorSummary.PATIENT_UPDATED =
                persistenceCounters.patientsUpdated;
            persistedErrorSummary.PRACTITIONER_INSERTED =
                persistenceCounters.practitionersInserted;
            persistedErrorSummary.PRACTITIONER_UPDATED =
                persistenceCounters.practitionersUpdated;
            persistedErrorSummary.ENCOUNTER_INSERTED =
                persistenceCounters.encountersInserted;
            persistedErrorSummary.ENCOUNTER_UPDATED =
                persistenceCounters.encountersUpdated;
            persistedErrorSummary.OBSERVATION_INSERTED =
                persistenceCounters.observationsInserted;
            persistedErrorSummary.OBSERVATION_UPDATED =
                persistenceCounters.observationsUpdated;
            persistedErrorSummary.CONDITION_INSERTED =
                persistenceCounters.conditionsInserted;
            persistedErrorSummary.CONDITION_UPDATED =
                persistenceCounters.conditionsUpdated;
            persistedErrorSummary.MEDICATION_INSERTED =
                persistenceCounters.medicationsInserted;
            persistedErrorSummary.MEDICATION_UPDATED =
                persistenceCounters.medicationsUpdated;
            persistedErrorSummary.SUBSTANCE_INSERTED =
                persistenceCounters.substancesInserted;
            persistedErrorSummary.SUBSTANCE_UPDATED =
                persistenceCounters.substancesUpdated;
            persistedErrorSummary.ALLERGY_INSERTED =
                persistenceCounters.allergiesInserted;
            persistedErrorSummary.ALLERGY_UPDATED =
                persistenceCounters.allergiesUpdated;
            persistedErrorSummary.PROCEDURE_INSERTED =
                persistenceCounters.proceduresInserted;
            persistedErrorSummary.PROCEDURE_UPDATED =
                persistenceCounters.proceduresUpdated;
            persistedErrorSummary.DIAGNOSTIC_REPORT_INSERTED =
                persistenceCounters.diagnosticReportsInserted;
            persistedErrorSummary.DIAGNOSTIC_REPORT_UPDATED =
                persistenceCounters.diagnosticReportsUpdated;
            persistedErrorSummary.ENCOUNTER_ANALYTICS_INSERTED =
                persistenceCounters.encounterAnalyticsInserted;
            persistedErrorSummary.ENCOUNTER_ANALYTICS_UPDATED =
                persistenceCounters.encounterAnalyticsUpdated;
            persistedErrorSummary.MEDICATION_ANALYTICS_INSERTED =
                persistenceCounters.medicationAnalyticsInserted;
            persistedErrorSummary.MEDICATION_ANALYTICS_UPDATED =
                persistenceCounters.medicationAnalyticsUpdated;
            persistedErrorSummary.COMPLIANCE_FLAG_INSERTED =
                persistenceCounters.complianceFlagsInserted;
            persistedErrorSummary.RISK_SCORE_INSERTED =
                persistenceCounters.riskScoresInserted;
            persistedErrorSummary.AUDIT_LOG_INSERTED =
                persistenceCounters.auditLogsInserted;

            await db.insert(ingestionStats).values({
                organizationId,
                date: new Date(),
                source: job.sourceType,
                // Track unique patient sources touched in this ingestion run,
                // not row-level upserts (which can include repeated patients).
                patients: uniquePatientSourceIds.size,
                observations:
                    persistenceCounters.observationsInserted +
                    persistenceCounters.observationsUpdated,
                conditions:
                    persistenceCounters.conditionsInserted +
                    persistenceCounters.conditionsUpdated,
                allergies:
                    persistenceCounters.allergiesInserted +
                    persistenceCounters.allergiesUpdated,
                medications:
                    persistenceCounters.medicationsInserted +
                    persistenceCounters.medicationsUpdated,
                procedures:
                    persistenceCounters.proceduresInserted +
                    persistenceCounters.proceduresUpdated,
                encounters:
                    persistenceCounters.encountersInserted +
                    persistenceCounters.encountersUpdated,
                diagnosticReports:
                    persistenceCounters.diagnosticReportsInserted +
                    persistenceCounters.diagnosticReportsUpdated,
            });

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
        persistenceCounters: PersistenceCounters,
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

        const patientName = this.buildPatientName(normalized);
        const patientGender = this.pickFirst(normalized, [
            'gender',
            'patient_gender',
        ]);
        const patientIdentifier = this.buildPatientIdentifier(normalized);
        const patientAddress = this.buildPatientAddress(normalized);
        const patientExtension = this.buildPatientExtension(normalized);
        const patientBirthDate = this.parseDate(
            this.pickFirst(normalized, [
                'birth_date',
                'patient_dob',
                'patient_birth_date',
            ]),
        );

        const patientUpdateSet: {
            updatedAt: Date;
            name?: unknown;
            gender?: string;
            birthDate?: Date;
            identifier?: unknown;
            address?: unknown;
            extension?: Record<string, unknown>;
        } = {
            updatedAt: new Date(),
        };

        if (patientName !== null) {
            patientUpdateSet.name = patientName;
        }
        if (patientGender !== null) {
            patientUpdateSet.gender = patientGender;
        }
        if (patientBirthDate !== null) {
            patientUpdateSet.birthDate = patientBirthDate;
        }
        if (patientIdentifier !== null) {
            patientUpdateSet.identifier = patientIdentifier;
        }
        if (patientAddress !== null) {
            patientUpdateSet.address = patientAddress;
        }
        if (patientExtension !== null) {
            patientUpdateSet.extension = patientExtension;
        }

        const [upsertedPatient] = await db
            .insert(patients)
            .values({
                organizationId,
                sourceId: patientSourceId,
                identifier: patientIdentifier,
                name: patientName,
                gender: patientGender,
                birthDate: patientBirthDate,
                address: patientAddress,
                extension: patientExtension,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: [patients.organizationId, patients.sourceId],
                set: patientUpdateSet,
            })
            .returning({ id: patients.id });

        const patientAction = existingPatient ? 'UPDATED' : 'INSERTED';
        if (patientAction === 'INSERTED') {
            persistenceCounters.patientsInserted += 1;
        } else {
            persistenceCounters.patientsUpdated += 1;
        }

        const persistedEntities: Record<string, unknown> = {
            patient: {
                id: upsertedPatient.id,
                action: patientAction,
                sourceId: patientSourceId,
            },
        };
        const entityActions: Array<'INSERTED' | 'UPDATED'> = [patientAction];

        const practitionerSourceId = this.pickSourceId(normalized, [
            'practitioner_epic_id',
            'practitioner_id',
        ]);

        if (practitionerSourceId) {
            const [existingPractitioner] = await db
                .select({ id: practitioners.id })
                .from(practitioners)
                .where(
                    and(
                        eq(practitioners.organizationId, organizationId),
                        eq(practitioners.sourceId, practitionerSourceId),
                    ),
                )
                .limit(1);

            const practitionerName = this.buildPractitionerName(normalized);
            const practitionerGender = this.pickFirst(normalized, [
                'practitioner_gender',
            ]);
            const practitionerBirthDate = this.parseDate(
                this.pickFirst(normalized, ['practitioner_birth_date']),
            );

            const practitionerUpdateSet: {
                updatedAt: Date;
                name?: unknown;
                gender?: string;
                birthDate?: Date;
            } = {
                updatedAt: new Date(),
            };

            if (practitionerName !== null) {
                practitionerUpdateSet.name = practitionerName;
            }
            if (practitionerGender !== null) {
                practitionerUpdateSet.gender = practitionerGender;
            }
            if (practitionerBirthDate !== null) {
                practitionerUpdateSet.birthDate = practitionerBirthDate;
            }

            const [upsertedPractitioner] = await db
                .insert(practitioners)
                .values({
                    organizationId,
                    sourceId: practitionerSourceId,
                    name: practitionerName,
                    gender: practitionerGender,
                    birthDate: practitionerBirthDate,
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [practitioners.organizationId, practitioners.sourceId],
                    set: practitionerUpdateSet,
                })
                .returning({ id: practitioners.id });

            const practitionerAction = existingPractitioner ? 'UPDATED' : 'INSERTED';
            entityActions.push(practitionerAction);
            if (practitionerAction === 'INSERTED') {
                persistenceCounters.practitionersInserted += 1;
            } else {
                persistenceCounters.practitionersUpdated += 1;
            }

            persistedEntities.practitioner = {
                id: upsertedPractitioner.id,
                action: practitionerAction,
                sourceId: practitionerSourceId,
            };
        }

        const encounterSourceId = this.pickSourceId(normalized, [
            'encounter_epic_id',
            'encounter_id',
            'encounterid',
        ]);

        let encounterAction: 'INSERTED' | 'UPDATED' | null = null;
        let encounterId: string | null = null;
        let medicationId: string | null = null;

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

            const encounterStatus = this.pickFirst(normalized, [
                'encounter_status',
                'status',
            ]);
            const encounterType = this.buildEncounterType(normalized);
            const encounterClass = this.buildEncounterClass(normalized);
            const encounterPeriod = this.buildEncounterPeriod(normalized);
            const encounterLocation = this.buildEncounterLocation(normalized);
            const encounterParticipant = this.buildEncounterParticipant(normalized);
            const encounterServiceProvider = this.pickFirst(normalized, [
                'organization_name',
                'service_provider',
            ]);
            const encounterExtension = this.buildEncounterExtension(normalized);

            const [upsertedEncounter] = await db
                .insert(encounters)
                .values({
                    organizationId,
                    sourceId: encounterSourceId,
                    patientId: upsertedPatient.id,
                    status: encounterStatus,
                    class: encounterClass,
                    type: encounterType,
                    period: encounterPeriod,
                    location: encounterLocation,
                    participant: encounterParticipant,
                    serviceProvider: encounterServiceProvider,
                    extension: encounterExtension,
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [encounters.organizationId, encounters.sourceId],
                    set: {
                        patientId: upsertedPatient.id,
                        status: encounterStatus,
                        class: encounterClass,
                        type: encounterType,
                        period: encounterPeriod,
                        location: encounterLocation,
                        participant: encounterParticipant,
                        serviceProvider: encounterServiceProvider,
                        extension: encounterExtension,
                        updatedAt: new Date(),
                    },
                })
                .returning({ id: encounters.id });

            encounterAction = existingEncounter ? 'UPDATED' : 'INSERTED';
            entityActions.push(encounterAction);
            encounterId = upsertedEncounter.id;
            if (encounterAction === 'INSERTED') {
                persistenceCounters.encountersInserted += 1;
            } else {
                persistenceCounters.encountersUpdated += 1;
            }

            persistedEntities.encounter = {
                id: encounterId,
                action: encounterAction,
                sourceId: encounterSourceId,
            };
        }

        const observationSourceId = this.pickSourceId(normalized, [
            'observation_epic_id',
            'observation_id',
        ]);

        if (observationSourceId) {
            const [existingObservation] = await db
                .select({ id: observations.id })
                .from(observations)
                .where(
                    and(
                        eq(observations.organizationId, organizationId),
                        eq(observations.sourceId, observationSourceId),
                    ),
                )
                .limit(1);

            const observationStatus =
                this.pickFirst(normalized, ['observation_status']) ?? 'final';
            const observationCategory = this.buildCodeableConcept(
                this.pickFirst(normalized, ['observation_category']) ?? 'vital-signs',
                null,
            );
            const observationDisplay = this.pickFirst(normalized, [
                'observation_test_name',
                'observation_name',
            ]);
            const observationCode = this.pickFirst(normalized, ['observation_code']);
            const observationEffectiveDate = this.parseDate(
                this.pickFirst(normalized, ['observation_date']),
            );
            const observationValue = this.pickFirst(normalized, [
                'observation_value',
            ]);
            const observationUnit = this.pickFirst(normalized, ['observation_unit']);

            const [upsertedObservation] = await db
                .insert(observations)
                .values({
                    organizationId,
                    sourceId: observationSourceId,
                    patientId: upsertedPatient.id,
                    status: observationStatus,
                    category: observationCategory,
                    code: this.buildCodeableConcept(observationDisplay, observationCode),
                    effectiveDateTime: observationEffectiveDate,
                    valueQuantity: this.buildQuantity(observationValue, observationUnit),
                    valueCodeableConcept: null,
                    valueString: observationValue,
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [observations.organizationId, observations.sourceId],
                    set: {
                        patientId: upsertedPatient.id,
                        status: observationStatus,
                        category: observationCategory,
                        code: this.buildCodeableConcept(
                            observationDisplay,
                            observationCode,
                        ),
                        effectiveDateTime: observationEffectiveDate,
                        valueQuantity: this.buildQuantity(
                            observationValue,
                            observationUnit,
                        ),
                        valueCodeableConcept: null,
                        valueString: observationValue,
                        updatedAt: new Date(),
                    },
                })
                .returning({ id: observations.id });

            const observationAction = existingObservation ? 'UPDATED' : 'INSERTED';
            entityActions.push(observationAction);
            if (observationAction === 'INSERTED') {
                persistenceCounters.observationsInserted += 1;
            } else {
                persistenceCounters.observationsUpdated += 1;
            }

            persistedEntities.observation = {
                id: upsertedObservation.id,
                action: observationAction,
                sourceId: observationSourceId,
            };
        }

        const conditionSourceId = this.pickSourceId(normalized, [
            'condition_epic_id',
            'condition_id',
        ]);

        if (conditionSourceId) {
            const [existingCondition] = await db
                .select({ id: conditions.id })
                .from(conditions)
                .where(
                    and(
                        eq(conditions.organizationId, organizationId),
                        eq(conditions.sourceId, conditionSourceId),
                    ),
                )
                .limit(1);

            const conditionStatus = this.pickFirst(normalized, [
                'condition_status',
                'clinical_status',
            ]);
            const conditionCode = this.pickFirst(normalized, ['condition_code']);
            const conditionDisplay = this.pickFirst(normalized, [
                'condition_diagnosis',
                'condition_display',
                'primary_diagnosis',
            ]);

            const [upsertedCondition] = await db
                .insert(conditions)
                .values({
                    organizationId,
                    sourceId: conditionSourceId,
                    patientId: upsertedPatient.id,
                    clinicalStatus: this.buildCodeableConcept(conditionStatus, null),
                    verificationStatus: this.buildCodeableConcept(
                        this.pickFirst(normalized, ['condition_verification_status']),
                        null,
                    ),
                    category: this.buildCodeableConcept(
                        this.pickFirst(normalized, ['condition_category']),
                        null,
                    ),
                    code: this.buildCodeableConcept(conditionDisplay, conditionCode),
                    onsetDateTime: this.parseDate(
                        this.pickFirst(normalized, ['condition_onset_date', 'onset_date']),
                    ),
                    recordedDate:
                        this.parseDate(
                            this.pickFirst(normalized, [
                                'condition_recorded_date',
                                'recorded_date',
                            ]),
                        ) ?? new Date(),
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [conditions.organizationId, conditions.sourceId],
                    set: {
                        patientId: upsertedPatient.id,
                        clinicalStatus: this.buildCodeableConcept(conditionStatus, null),
                        verificationStatus: this.buildCodeableConcept(
                            this.pickFirst(normalized, ['condition_verification_status']),
                            null,
                        ),
                        category: this.buildCodeableConcept(
                            this.pickFirst(normalized, ['condition_category']),
                            null,
                        ),
                        code: this.buildCodeableConcept(conditionDisplay, conditionCode),
                        onsetDateTime: this.parseDate(
                            this.pickFirst(normalized, [
                                'condition_onset_date',
                                'onset_date',
                            ]),
                        ),
                        recordedDate:
                            this.parseDate(
                                this.pickFirst(normalized, [
                                    'condition_recorded_date',
                                    'recorded_date',
                                ]),
                            ) ?? new Date(),
                        updatedAt: new Date(),
                    },
                })
                .returning({ id: conditions.id });

            const conditionAction = existingCondition ? 'UPDATED' : 'INSERTED';
            entityActions.push(conditionAction);
            if (conditionAction === 'INSERTED') {
                persistenceCounters.conditionsInserted += 1;
            } else {
                persistenceCounters.conditionsUpdated += 1;
            }

            persistedEntities.condition = {
                id: upsertedCondition.id,
                action: conditionAction,
                sourceId: conditionSourceId,
            };
        }

        const medicationSourceId = this.pickSourceId(normalized, [
            'medication_epic_id',
            'medication_request_id',
            'medication_id',
        ]);

        if (medicationSourceId) {
            const [existingMedication] = await db
                .select({ id: medications.id })
                .from(medications)
                .where(
                    and(
                        eq(medications.organizationId, organizationId),
                        eq(medications.sourceId, medicationSourceId),
                    ),
                )
                .limit(1);

            const medicationName = this.pickFirst(normalized, [
                'medication_name',
                'medication_prescribed',
            ]);
            const medicationCode = this.pickFirst(normalized, ['medication_code']);
            const medicationStatus = this.pickFirst(normalized, [
                'medication_status',
            ]);
            const medicationDosage = this.pickFirst(normalized, [
                'medication_dosage',
            ]);
            const medicationRoute = this.pickFirst(normalized, ['medication_route']);
            const medicationAuthoredOn = this.parseDate(
                this.pickFirst(normalized, ['authored_on']),
            );
            const medicationExtension = this.buildMedicationExtension(normalized);

            const [upsertedMedication] = await db
                .insert(medications)
                .values({
                    organizationId,
                    sourceId: medicationSourceId,
                    patientId: upsertedPatient.id,
                    status: medicationStatus,
                    intent: this.pickFirst(normalized, ['medication_intent']),
                    medicationCodeableConcept: this.buildCodeableConcept(
                        medicationName,
                        medicationCode,
                    ),
                    dosageInstruction: medicationDosage
                        ? [{ text: medicationDosage, route: medicationRoute }]
                        : null,
                    dispenseRequest: medicationAuthoredOn
                        ? {
                            authoredOn: medicationAuthoredOn.toISOString(),
                        }
                        : null,
                    extension: medicationExtension,
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [medications.organizationId, medications.sourceId],
                    set: {
                        patientId: upsertedPatient.id,
                        status: medicationStatus,
                        intent: this.pickFirst(normalized, ['medication_intent']),
                        medicationCodeableConcept: this.buildCodeableConcept(
                            medicationName,
                            medicationCode,
                        ),
                        dosageInstruction: medicationDosage
                            ? [{ text: medicationDosage, route: medicationRoute }]
                            : null,
                        dispenseRequest: medicationAuthoredOn
                            ? {
                                authoredOn: medicationAuthoredOn.toISOString(),
                            }
                            : null,
                        extension: medicationExtension,
                        updatedAt: new Date(),
                    },
                })
                .returning({ id: medications.id });

            const medicationAction = existingMedication ? 'UPDATED' : 'INSERTED';
            entityActions.push(medicationAction);
            if (medicationAction === 'INSERTED') {
                persistenceCounters.medicationsInserted += 1;
            } else {
                persistenceCounters.medicationsUpdated += 1;
            }

            persistedEntities.medication = {
                id: upsertedMedication.id,
                action: medicationAction,
                sourceId: medicationSourceId,
            };

            medicationId = upsertedMedication.id;
        }

        const substanceSourceId = this.pickSourceId(normalized, [
            'substance_epic_id',
            'substance_id',
        ]);

        if (substanceSourceId) {
            const [existingSubstance] = await db
                .select({ id: substances.id })
                .from(substances)
                .where(
                    and(
                        eq(substances.organizationId, organizationId),
                        eq(substances.sourceId, substanceSourceId),
                    ),
                )
                .limit(1);

            const [upsertedSubstance] = await db
                .insert(substances)
                .values({
                    organizationId,
                    sourceId: substanceSourceId,
                    patientId: upsertedPatient.id,
                    encounterId,
                    status: this.pickFirst(normalized, ['substance_status']),
                    code: this.pickFirst(normalized, ['substance_code']),
                    codeDisplay: this.pickFirst(normalized, [
                        'substance_code_display',
                    ]),
                    category: this.pickFirst(normalized, ['substance_category']),
                    instance: this.pickFirst(normalized, ['substance_instance']),
                    quantityValue: this.pickFirst(normalized, [
                        'substance_quantity_value',
                    ]),
                    quantityUnit: this.pickFirst(normalized, [
                        'substance_quantity_unit',
                    ]),
                    expiry: this.parseDate(
                        this.pickFirst(normalized, ['substance_expiry']),
                    ),
                    description: this.pickFirst(normalized, [
                        'substance_description',
                    ]),
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [substances.organizationId, substances.sourceId],
                    set: {
                        patientId: upsertedPatient.id,
                        encounterId,
                        status: this.pickFirst(normalized, ['substance_status']),
                        code: this.pickFirst(normalized, ['substance_code']),
                        codeDisplay: this.pickFirst(normalized, [
                            'substance_code_display',
                        ]),
                        category: this.pickFirst(normalized, ['substance_category']),
                        instance: this.pickFirst(normalized, ['substance_instance']),
                        quantityValue: this.pickFirst(normalized, [
                            'substance_quantity_value',
                        ]),
                        quantityUnit: this.pickFirst(normalized, [
                            'substance_quantity_unit',
                        ]),
                        expiry: this.parseDate(
                            this.pickFirst(normalized, ['substance_expiry']),
                        ),
                        description: this.pickFirst(normalized, [
                            'substance_description',
                        ]),
                        updatedAt: new Date(),
                    },
                })
                .returning({ id: substances.id });

            const substanceAction = existingSubstance ? 'UPDATED' : 'INSERTED';
            entityActions.push(substanceAction);
            if (substanceAction === 'INSERTED') {
                persistenceCounters.substancesInserted += 1;
            } else {
                persistenceCounters.substancesUpdated += 1;
            }

            persistedEntities.substance = {
                id: upsertedSubstance.id,
                action: substanceAction,
                sourceId: substanceSourceId,
            };
        }

        if (encounterId) {
            const [existingEncounterProjection] = await db
                .select({ id: encounterAnalytics.id })
                .from(encounterAnalytics)
                .where(
                    and(
                        eq(encounterAnalytics.organizationId, organizationId),
                        eq(encounterAnalytics.encounterId, encounterId),
                    ),
                )
                .limit(1);

            const providerLocationState = this.pickFirst(normalized, [
                'provider_location_state',
            ]);
            const patientLocationState = this.pickFirst(normalized, [
                'patient_location_state',
            ]);

            const [upsertedEncounterProjection] = await db
                .insert(encounterAnalytics)
                .values({
                    organizationId,
                    encounterId,
                    isTelehealth: this.parseBoolean(
                        this.pickFirst(normalized, ['is_telehealth']),
                    ),
                    crossStateFlag:
                        this.parseBoolean(
                            this.pickFirst(normalized, ['cross_state_license']),
                        ) ??
                        (providerLocationState && patientLocationState
                            ? providerLocationState !== patientLocationState
                            : null),
                    hipaaPlatformValidated: this.parseBoolean(
                        this.pickFirst(normalized, ['hipaa_compliant_platform']),
                    ),
                    durationMinutes: this.parseInteger(
                        this.pickFirst(normalized, [
                            'session_duration',
                            'session_duration_min',
                        ]),
                    ),
                    documentationComplete: this.parseBoolean(
                        this.pickFirst(normalized, ['clinical_notes_completed']),
                    ),
                    patientIdentityVerified: this.parseBoolean(
                        this.pickFirst(normalized, ['patient_identity_verified']),
                    ),
                    sessionRecordingConsent: this.parseBoolean(
                        this.pickFirst(normalized, ['session_recording_consent']),
                    ),
                    providerLocationState,
                    patientLocationState,
                    stateLicensureVerified: this.parseBoolean(
                        this.pickFirst(normalized, ['state_licensure_verified']),
                    ),
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [encounterAnalytics.encounterId],
                    set: {
                        isTelehealth: this.parseBoolean(
                            this.pickFirst(normalized, ['is_telehealth']),
                        ),
                        crossStateFlag:
                            this.parseBoolean(
                                this.pickFirst(normalized, ['cross_state_license']),
                            ) ??
                            (providerLocationState && patientLocationState
                                ? providerLocationState !== patientLocationState
                                : null),
                        hipaaPlatformValidated: this.parseBoolean(
                            this.pickFirst(normalized, ['hipaa_compliant_platform']),
                        ),
                        durationMinutes: this.parseInteger(
                            this.pickFirst(normalized, [
                                'session_duration',
                                'session_duration_min',
                            ]),
                        ),
                        documentationComplete: this.parseBoolean(
                            this.pickFirst(normalized, ['clinical_notes_completed']),
                        ),
                        patientIdentityVerified: this.parseBoolean(
                            this.pickFirst(normalized, ['patient_identity_verified']),
                        ),
                        sessionRecordingConsent: this.parseBoolean(
                            this.pickFirst(normalized, ['session_recording_consent']),
                        ),
                        providerLocationState,
                        patientLocationState,
                        stateLicensureVerified: this.parseBoolean(
                            this.pickFirst(normalized, ['state_licensure_verified']),
                        ),
                        updatedAt: new Date(),
                    },
                })
                .returning({ id: encounterAnalytics.id });

            const encounterProjectionAction = existingEncounterProjection
                ? 'UPDATED'
                : 'INSERTED';
            entityActions.push(encounterProjectionAction);
            if (encounterProjectionAction === 'INSERTED') {
                persistenceCounters.encounterAnalyticsInserted += 1;
            } else {
                persistenceCounters.encounterAnalyticsUpdated += 1;
            }

            persistedEntities.encounterAnalytics = {
                id: upsertedEncounterProjection.id,
                action: encounterProjectionAction,
                encounterId,
            };
        }

        if (medicationId) {
            const [existingMedicationProjection] = await db
                .select({ id: medicationAnalytics.id })
                .from(medicationAnalytics)
                .where(
                    and(
                        eq(medicationAnalytics.organizationId, organizationId),
                        eq(medicationAnalytics.medicationId, medicationId),
                    ),
                )
                .limit(1);

            const [upsertedMedicationProjection] = await db
                .insert(medicationAnalytics)
                .values({
                    organizationId,
                    medicationId,
                    controlledSubstance: this.parseBoolean(
                        this.pickFirst(normalized, [
                            'controlled_substance_prescribed',
                        ]),
                    ),
                    deaSchedule: this.pickFirst(normalized, ['dea_schedule']),
                    refillCount: this.parseInteger(
                        this.pickFirst(normalized, ['refill_count']),
                    ),
                    autoRefillEnabled: this.parseBoolean(
                        this.pickFirst(normalized, ['auto_refill_enabled']),
                    ),
                    medicationAdherence: this.pickFirst(normalized, [
                        'medication_adherence',
                    ]),
                    prescriberDea: this.pickFirst(normalized, ['prescriber_dea']),
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [medicationAnalytics.medicationId],
                    set: {
                        controlledSubstance: this.parseBoolean(
                            this.pickFirst(normalized, [
                                'controlled_substance_prescribed',
                            ]),
                        ),
                        deaSchedule: this.pickFirst(normalized, ['dea_schedule']),
                        refillCount: this.parseInteger(
                            this.pickFirst(normalized, ['refill_count']),
                        ),
                        autoRefillEnabled: this.parseBoolean(
                            this.pickFirst(normalized, ['auto_refill_enabled']),
                        ),
                        medicationAdherence: this.pickFirst(normalized, [
                            'medication_adherence',
                        ]),
                        prescriberDea: this.pickFirst(normalized, [
                            'prescriber_dea',
                        ]),
                        updatedAt: new Date(),
                    },
                })
                .returning({ id: medicationAnalytics.id });

            const medicationProjectionAction = existingMedicationProjection
                ? 'UPDATED'
                : 'INSERTED';
            entityActions.push(medicationProjectionAction);
            if (medicationProjectionAction === 'INSERTED') {
                persistenceCounters.medicationAnalyticsInserted += 1;
            } else {
                persistenceCounters.medicationAnalyticsUpdated += 1;
            }

            persistedEntities.medicationAnalytics = {
                id: upsertedMedicationProjection.id,
                action: medicationProjectionAction,
                medicationId,
            };
        }

        const allergySourceId = this.pickSourceId(normalized, [
            'allergy_epic_id',
            'allergy_id',
        ]);

        if (allergySourceId) {
            const [existingAllergy] = await db
                .select({ id: allergies.id })
                .from(allergies)
                .where(
                    and(
                        eq(allergies.organizationId, organizationId),
                        eq(allergies.sourceId, allergySourceId),
                    ),
                )
                .limit(1);

            const allergyAllergen = this.pickFirst(normalized, ['allergy_allergen']);
            const [upsertedAllergy] = await db
                .insert(allergies)
                .values({
                    organizationId,
                    sourceId: allergySourceId,
                    patientId: upsertedPatient.id,
                    clinicalStatus: this.buildCodeableConcept(
                        this.pickFirst(normalized, ['allergy_status']),
                        null,
                    ),
                    verificationStatus: this.buildCodeableConcept(
                        this.pickFirst(normalized, ['allergy_verification_status']),
                        null,
                    ),
                    type: this.pickFirst(normalized, ['allergy_type']),
                    category: this.buildCodeableConcept(
                        this.pickFirst(normalized, ['allergy_category']),
                        null,
                    ),
                    criticality: this.pickFirst(normalized, ['allergy_criticality']),
                    code: this.buildCodeableConcept(allergyAllergen, null),
                    reaction: this.buildCodeableConcept(
                        this.pickFirst(normalized, ['allergy_reaction']),
                        null,
                    ),
                    recordedDate:
                        this.parseDate(
                            this.pickFirst(normalized, ['allergy_recorded_date']),
                        ) ?? new Date(),
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [allergies.organizationId, allergies.sourceId],
                    set: {
                        patientId: upsertedPatient.id,
                        clinicalStatus: this.buildCodeableConcept(
                            this.pickFirst(normalized, ['allergy_status']),
                            null,
                        ),
                        verificationStatus: this.buildCodeableConcept(
                            this.pickFirst(normalized, ['allergy_verification_status']),
                            null,
                        ),
                        type: this.pickFirst(normalized, ['allergy_type']),
                        category: this.buildCodeableConcept(
                            this.pickFirst(normalized, ['allergy_category']),
                            null,
                        ),
                        criticality: this.pickFirst(normalized, ['allergy_criticality']),
                        code: this.buildCodeableConcept(allergyAllergen, null),
                        reaction: this.buildCodeableConcept(
                            this.pickFirst(normalized, ['allergy_reaction']),
                            null,
                        ),
                        recordedDate:
                            this.parseDate(
                                this.pickFirst(normalized, ['allergy_recorded_date']),
                            ) ?? new Date(),
                        updatedAt: new Date(),
                    },
                })
                .returning({ id: allergies.id });

            const allergyAction = existingAllergy ? 'UPDATED' : 'INSERTED';
            entityActions.push(allergyAction);
            if (allergyAction === 'INSERTED') {
                persistenceCounters.allergiesInserted += 1;
            } else {
                persistenceCounters.allergiesUpdated += 1;
            }

            persistedEntities.allergy = {
                id: upsertedAllergy.id,
                action: allergyAction,
                sourceId: allergySourceId,
            };
        }

        const procedureSourceId = this.pickSourceId(normalized, [
            'procedure_epic_id',
            'procedure_id',
        ]);

        if (procedureSourceId) {
            const [existingProcedure] = await db
                .select({ id: procedures.id })
                .from(procedures)
                .where(
                    and(
                        eq(procedures.organizationId, organizationId),
                        eq(procedures.sourceId, procedureSourceId),
                    ),
                )
                .limit(1);

            const procedureName = this.pickFirst(normalized, ['procedure_name']);
            const procedureCode = this.pickFirst(normalized, ['procedure_code']);

            const [upsertedProcedure] = await db
                .insert(procedures)
                .values({
                    organizationId,
                    sourceId: procedureSourceId,
                    patientId: upsertedPatient.id,
                    status: this.pickFirst(normalized, ['procedure_status']),
                    statusReason: this.buildCodeableConcept(
                        this.pickFirst(normalized, ['procedure_status_reason']),
                        null,
                    ),
                    category: this.buildCodeableConcept(
                        this.pickFirst(normalized, ['procedure_category']),
                        null,
                    ),
                    code: this.buildCodeableConcept(procedureName, procedureCode),
                    performedDateTime: this.parseDate(
                        this.pickFirst(normalized, ['procedure_performed_date']),
                    ),
                    outcome: this.buildCodeableConcept(
                        this.pickFirst(normalized, ['procedure_outcome']),
                        null,
                    ),
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [procedures.organizationId, procedures.sourceId],
                    set: {
                        patientId: upsertedPatient.id,
                        status: this.pickFirst(normalized, ['procedure_status']),
                        statusReason: this.buildCodeableConcept(
                            this.pickFirst(normalized, ['procedure_status_reason']),
                            null,
                        ),
                        category: this.buildCodeableConcept(
                            this.pickFirst(normalized, ['procedure_category']),
                            null,
                        ),
                        code: this.buildCodeableConcept(procedureName, procedureCode),
                        performedDateTime: this.parseDate(
                            this.pickFirst(normalized, ['procedure_performed_date']),
                        ),
                        outcome: this.buildCodeableConcept(
                            this.pickFirst(normalized, ['procedure_outcome']),
                            null,
                        ),
                        updatedAt: new Date(),
                    },
                })
                .returning({ id: procedures.id });

            const procedureAction = existingProcedure ? 'UPDATED' : 'INSERTED';
            entityActions.push(procedureAction);
            if (procedureAction === 'INSERTED') {
                persistenceCounters.proceduresInserted += 1;
            } else {
                persistenceCounters.proceduresUpdated += 1;
            }

            persistedEntities.procedure = {
                id: upsertedProcedure.id,
                action: procedureAction,
                sourceId: procedureSourceId,
            };
        }

        const diagnosticReportSourceId = this.pickSourceId(normalized, [
            'diagnostic_report_epic_id',
            'diagnostic_report_id',
        ]);

        if (diagnosticReportSourceId) {
            const [existingDiagnosticReport] = await db
                .select({ id: diagnosticReports.id })
                .from(diagnosticReports)
                .where(
                    and(
                        eq(diagnosticReports.organizationId, organizationId),
                        eq(diagnosticReports.sourceId, diagnosticReportSourceId),
                    ),
                )
                .limit(1);

            const diagnosticReportName = this.pickFirst(normalized, [
                'diagnostic_report_name',
            ]);
            const diagnosticReportCode = this.pickFirst(normalized, [
                'diagnostic_report_code',
            ]);
            const diagnosticReportDate = this.parseDate(
                this.pickFirst(normalized, ['diagnostic_report_date']),
            );

            const [upsertedDiagnosticReport] = await db
                .insert(diagnosticReports)
                .values({
                    organizationId,
                    sourceId: diagnosticReportSourceId,
                    patientId: upsertedPatient.id,
                    status: this.pickFirst(normalized, ['diagnostic_report_status']),
                    category: this.buildCodeableConcept(
                        this.pickFirst(normalized, ['diagnostic_report_category']),
                        null,
                    ),
                    code: this.buildCodeableConcept(
                        diagnosticReportName,
                        diagnosticReportCode,
                    ),
                    effectiveDateTime: diagnosticReportDate,
                    issued:
                        this.parseDate(
                            this.pickFirst(normalized, ['diagnostic_report_issued_date']),
                        ) ?? diagnosticReportDate,
                    conclusion: this.pickFirst(normalized, [
                        'diagnostic_report_conclusion',
                    ]),
                    conclusionCode: this.buildCodeableConcept(
                        this.pickFirst(normalized, ['diagnostic_report_conclusion_code']),
                        null,
                    ),
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [
                        diagnosticReports.organizationId,
                        diagnosticReports.sourceId,
                    ],
                    set: {
                        patientId: upsertedPatient.id,
                        status: this.pickFirst(normalized, ['diagnostic_report_status']),
                        category: this.buildCodeableConcept(
                            this.pickFirst(normalized, ['diagnostic_report_category']),
                            null,
                        ),
                        code: this.buildCodeableConcept(
                            diagnosticReportName,
                            diagnosticReportCode,
                        ),
                        effectiveDateTime: diagnosticReportDate,
                        issued:
                            this.parseDate(
                                this.pickFirst(normalized, ['diagnostic_report_issued_date']),
                            ) ?? diagnosticReportDate,
                        conclusion: this.pickFirst(normalized, [
                            'diagnostic_report_conclusion',
                        ]),
                        conclusionCode: this.buildCodeableConcept(
                            this.pickFirst(normalized, ['diagnostic_report_conclusion_code']),
                            null,
                        ),
                        updatedAt: new Date(),
                    },
                })
                .returning({ id: diagnosticReports.id });

            const diagnosticReportAction = existingDiagnosticReport
                ? 'UPDATED'
                : 'INSERTED';
            entityActions.push(diagnosticReportAction);
            if (diagnosticReportAction === 'INSERTED') {
                persistenceCounters.diagnosticReportsInserted += 1;
            } else {
                persistenceCounters.diagnosticReportsUpdated += 1;
            }

            persistedEntities.diagnosticReport = {
                id: upsertedDiagnosticReport.id,
                action: diagnosticReportAction,
                sourceId: diagnosticReportSourceId,
            };
        }

        const rowOutcome = entityActions.includes('UPDATED')
            ? 'UPDATED'
            : 'INSERTED';

        const complianceSummary =
            await this.persistComplianceEvaluationForRow(
                organizationId,
                normalized,
                upsertedPatient.id,
                encounterId,
                persistenceCounters,
            );

        if (complianceSummary) {
            persistedEntities.compliance = complianceSummary;
        }

        const materializedEntityCount = Object.keys(persistedEntities).length;

        return {
            outcome: rowOutcome,
            message: `Persisted ${materializedEntityCount} clinical entities successfully`,
            persisted: {
                status: 'PERSISTED',
                persistedAt: new Date().toISOString(),
                ...persistedEntities,
            },
        };
    }

    private async persistComplianceEvaluationForRow(
        organizationId: string,
        row: Record<string, string | null>,
        patientId: string,
        encounterId: string | null,
        persistenceCounters: PersistenceCounters,
    ): Promise<Record<string, unknown> | null> {
        try {
            const isTelehealth = this.parseBoolean(
                this.pickFirst(row, ['is_telehealth']),
            );
            const documentationComplete = this.parseBoolean(
                this.pickFirst(row, ['clinical_notes_completed']),
            );
            const identityVerified = this.parseBoolean(
                this.pickFirst(row, ['patient_identity_verified']),
            );
            const stateLicensureVerified = this.parseBoolean(
                this.pickFirst(row, ['state_licensure_verified']),
            );
            const crossStateFlag =
                this.parseBoolean(this.pickFirst(row, ['cross_state_license'])) ??
                this.deriveCrossStateFlag(row);
            const controlledSubstance = this.parseBoolean(
                this.pickFirst(row, ['controlled_substance_prescribed']),
            );
            const prescriberDea = this.pickFirst(row, ['prescriber_dea']);

            const flagsToInsert: Array<typeof complianceFlags.$inferInsert> = [];
            const deductions: number[] = [];

            const scoreEntityType = encounterId ? 'ENCOUNTER' : 'PATIENT';
            const scoreEntityId = encounterId ?? patientId;

            if (isTelehealth === true && documentationComplete === false) {
                flagsToInsert.push({
                    organizationId,
                    entityType: scoreEntityType,
                    entityId: scoreEntityId,
                    flagType: 'MISSING_CLINICAL_DOCUMENTATION',
                    severity: 'HIGH',
                    description:
                        'Telehealth encounter missing complete clinical notes.',
                    updatedAt: new Date(),
                });
                deductions.push(30);
            }

            if (isTelehealth === true && identityVerified === false) {
                flagsToInsert.push({
                    organizationId,
                    entityType: scoreEntityType,
                    entityId: scoreEntityId,
                    flagType: 'PATIENT_IDENTITY_NOT_VERIFIED',
                    severity: 'HIGH',
                    description:
                        'Telehealth encounter was completed without patient identity verification.',
                    updatedAt: new Date(),
                });
                deductions.push(25);
            }

            if (crossStateFlag === true && stateLicensureVerified === false) {
                flagsToInsert.push({
                    organizationId,
                    entityType: scoreEntityType,
                    entityId: scoreEntityId,
                    flagType: 'CROSS_STATE_LICENSURE_NOT_VERIFIED',
                    severity: 'CRITICAL',
                    description:
                        'Cross-state encounter lacks verified state licensure.',
                    updatedAt: new Date(),
                });
                deductions.push(40);
            }

            if (controlledSubstance === true && !prescriberDea) {
                flagsToInsert.push({
                    organizationId,
                    entityType: scoreEntityType,
                    entityId: scoreEntityId,
                    flagType: 'MISSING_DEA_FOR_CONTROLLED_SUBSTANCE',
                    severity: 'CRITICAL',
                    description:
                        'Controlled substance was prescribed without a prescriber DEA value.',
                    updatedAt: new Date(),
                });
                deductions.push(45);
            }

            let insertedComplianceFlagIds: string[] = [];
            if (flagsToInsert.length > 0) {
                const insertedFlags = await db
                    .insert(complianceFlags)
                    .values(flagsToInsert)
                    .returning({ id: complianceFlags.id });
                insertedComplianceFlagIds = insertedFlags.map((rowValue) => rowValue.id);
                persistenceCounters.complianceFlagsInserted +=
                    insertedComplianceFlagIds.length;
            }

            const deductionTotal = deductions.reduce(
                (sum, currentValue) => sum + currentValue,
                0,
            );
            const complianceScore = Math.max(0, 100 - deductionTotal);
            const riskLevel = this.deriveRiskLevel(complianceScore);

            const [insertedRiskScore] = await db
                .insert(riskScores)
                .values({
                    organizationId,
                    entityType: scoreEntityType,
                    entityId: scoreEntityId,
                    complianceScore,
                    riskLevel,
                    category: 'INGESTION_EVALUATION',
                    updatedAt: new Date(),
                })
                .returning({ id: riskScores.id });
            persistenceCounters.riskScoresInserted += 1;

            const [insertedAuditLog] = await db
                .insert(auditLogs)
                .values({
                    organizationId,
                    actorType: 'SYSTEM',
                    actorId: patientId,
                    action: 'INGESTION_COMPLIANCE_EVALUATED',
                    resourceType: scoreEntityType,
                    resourceId: scoreEntityId,
                    changes: {
                        complianceScore,
                        riskLevel,
                        triggeredFlags: flagsToInsert.map((flag) => ({
                            flagType: flag.flagType,
                            severity: flag.severity,
                        })),
                    },
                })
                .returning({ id: auditLogs.id });
            persistenceCounters.auditLogsInserted += 1;

            return {
                complianceFlagIds: insertedComplianceFlagIds,
                riskScoreId: insertedRiskScore.id,
                auditLogId: insertedAuditLog.id,
                complianceScore,
                riskLevel,
            };
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : 'Unknown compliance evaluation failure';
            this.logger.warn(
                `Compliance evaluation skipped for patient ${patientId}: ${errorMessage}`,
            );
            return null;
        }
    }

    private deriveCrossStateFlag(
        row: Record<string, string | null>,
    ): boolean | null {
        const providerLocationState = this.pickFirst(row, [
            'provider_location_state',
        ]);
        const patientLocationState = this.pickFirst(row, [
            'patient_location_state',
        ]);

        if (!providerLocationState || !patientLocationState) {
            return null;
        }

        return providerLocationState !== patientLocationState;
    }

    private deriveRiskLevel(score: number): string {
        if (score >= 85) {
            return 'LOW';
        }
        if (score >= 60) {
            return 'MEDIUM';
        }
        if (score >= 30) {
            return 'HIGH';
        }

        return 'CRITICAL';
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

    private parseBoolean(value: string | null): boolean | null {
        if (!value) {
            return null;
        }

        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y'].includes(normalized)) {
            return true;
        }
        if (['false', '0', 'no', 'n'].includes(normalized)) {
            return false;
        }

        return null;
    }

    private parseInteger(value: string | null): number | null {
        if (!value) {
            return null;
        }

        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return null;
        }

        return Math.trunc(parsed);
    }

    private buildPatientIdentifier(row: Record<string, string | null>): unknown {
        const system = this.pickFirst(row, ['patient_identifier_system']);
        const value = this.pickFirst(row, ['patient_identifier_value']);
        if (!system && !value) {
            return null;
        }

        const identifier: Record<string, unknown> = {};
        if (system) {
            identifier.system = system;
        }
        if (value) {
            identifier.value = value;
        }

        return [identifier];
    }

    private buildPatientAddress(row: Record<string, string | null>): unknown {
        const city = this.pickFirst(row, ['city']);
        const state = this.pickFirst(row, ['patient_location_state', 'state']);
        const postalCode = this.pickFirst(row, ['postal_code']);

        if (!city && !state && !postalCode) {
            return null;
        }

        return [
            {
                city,
                state,
                postalCode,
            },
        ];
    }

    private buildPatientExtension(
        row: Record<string, string | null>,
    ): Record<string, unknown> | null {
        return this.compactObject({
            race: this.pickFirst(row, ['race']),
            ethnicity: this.pickFirst(row, ['ethnicity']),
            sourceFile: this.pickFirst(row, ['source_file']),
        });
    }

    private buildEncounterClass(row: Record<string, string | null>): unknown {
        const code = this.pickFirst(row, ['encounter_class_code']);
        const display = this.pickFirst(row, ['encounter_class_display']);
        if (!code && !display) {
            return null;
        }

        return { code, display };
    }

    private buildEncounterPeriod(row: Record<string, string | null>): unknown {
        const start = this.parseDate(
            this.pickFirst(row, ['session_start_time', 'encounter_start_date']),
        );
        const end = this.parseDate(
            this.pickFirst(row, ['session_end_time', 'encounter_end_date']),
        );

        if (!start && !end) {
            return null;
        }

        return {
            start: start?.toISOString(),
            end: end?.toISOString(),
        };
    }

    private buildEncounterLocation(row: Record<string, string | null>): unknown {
        const providerState = this.pickFirst(row, ['provider_location_state']);
        const patientState = this.pickFirst(row, ['patient_location_state']);

        if (!providerState && !patientState) {
            return null;
        }

        return [{
            providerState,
            patientState,
        }];
    }

    private buildEncounterParticipant(
        row: Record<string, string | null>,
    ): unknown {
        const practitionerName = this.pickFirst(row, [
            'practitioner_name',
            'provider_name',
            'prescriber_name',
        ]);
        if (!practitionerName) {
            return null;
        }

        return [
            {
                individual: {
                    display: practitionerName,
                },
            },
        ];
    }

    private buildEncounterExtension(
        row: Record<string, string | null>,
    ): Record<string, unknown> | null {
        return this.compactObject({
            encounterTypeDetail: this.pickFirst(row, ['encounter_type_detail']),
            primaryDiagnosis: this.pickFirst(row, ['primary_diagnosis']),
            telehealthId: this.pickFirst(row, ['telehealth_id']),
            hipaaCompliantPlatformName: this.pickFirst(row, [
                'hipaa_compliant_platform_name',
            ]),
            identityVerificationMethod: this.pickFirst(row, [
                'identity_verification_method',
            ]),
            consentObtained: this.parseBoolean(
                this.pickFirst(row, ['consent_obtained']),
            ),
            consentDate: this.pickFirst(row, ['consent_date']),
            informedConsentType: this.pickFirst(row, ['informed_consent_type']),
            clinicalNotesStatus: this.pickFirst(row, ['clinical_notes_status']),
            noteSignedDate: this.pickFirst(row, ['note_signed_date']),
            chiefComplaint: this.pickFirst(row, ['chief_complaint']),
            mentalHealthScreening: this.pickFirst(row, [
                'mental_health_screening',
            ]),
            substanceUseScreening: this.pickFirst(row, [
                'substance_use_screening',
            ]),
            allergiesReviewed: this.pickFirst(row, ['allergies_reviewed']),
            vitalSignsRecorded: this.pickFirst(row, ['vital_signs_recorded']),
            medicationAdherence: this.pickFirst(row, ['medication_adherence']),
            medicationReconciliation: this.pickFirst(row, [
                'medication_reconciliation',
            ]),
            clinicalDecisionSupport: this.pickFirst(row, [
                'clinical_decision_support',
            ]),
            cdsAlertCount: this.parseInteger(this.pickFirst(row, ['cds_alert_count'])),
            overrideReason: this.pickFirst(row, ['override_reason']),
            technologyAssessment: this.pickFirst(row, ['technology_assessment']),
            carePlanUpdated: this.pickFirst(row, ['care_plan_updated']),
            followUpScheduled: this.parseBoolean(
                this.pickFirst(row, ['follow_up_scheduled']),
            ),
            followUpDate: this.pickFirst(row, ['follow_up_date']),
            coordinationWithPcp: this.parseBoolean(
                this.pickFirst(row, ['coordination_with_pcp']),
            ),
            qualityMeasureMet: this.pickFirst(row, ['quality_measure_met']),
            outcomeMeasured: this.pickFirst(row, ['outcome_measured']),
            clinicalProtocolApprovedBy: this.pickFirst(row, [
                'clinical_protocol_approved_by',
            ]),
            autoRefillPolicyCorporateMandated: this.parseBoolean(
                this.pickFirst(row, ['auto_refill_policy_corporate_mandated']),
            ),
            clinicalDecisionMaker: this.pickFirst(row, ['clinical_decision_maker']),
            organizationName: this.pickFirst(row, ['organization_name']),
            corporateStructure: this.pickFirst(row, ['corporate_structure']),
            physicianOwnershipPercentage: this.pickFirst(row, [
                'physician_ownership_percentage',
            ]),
            orgClinicalProtocolApprovedBy: this.pickFirst(row, [
                'org_clinical_protocol_approved_by',
            ]),
            orgAutoRefillPolicyCorporateMandated: this.parseBoolean(
                this.pickFirst(row, ['org_auto_refill_policy_corporate_mandated']),
            ),
        });
    }

    private buildMedicationExtension(
        row: Record<string, string | null>,
    ): Record<string, unknown> | null {
        return this.compactObject({
            controlledSubstancePrescribed: this.parseBoolean(
                this.pickFirst(row, ['controlled_substance_prescribed']),
            ),
            deaSchedule: this.pickFirst(row, ['dea_schedule']),
            prescriberName: this.pickFirst(row, ['prescriber_name']),
            prescriberDea: this.pickFirst(row, ['prescriber_dea']),
            prescriberStateLicensureVerified: this.parseBoolean(
                this.pickFirst(row, ['prescriber_state_licensure_verified']),
            ),
            autoRefillEnabled: this.parseBoolean(
                this.pickFirst(row, ['auto_refill_enabled']),
            ),
            refillCount: this.parseInteger(this.pickFirst(row, ['refill_count'])),
            authoredOn: this.pickFirst(row, ['authored_on']),
            medicationPrescribed: this.pickFirst(row, ['medication_prescribed']),
        });
    }

    private compactObject(
        input: Record<string, unknown>,
    ): Record<string, unknown> | null {
        const filteredEntries = Object.entries(input).filter(([, value]) => {
            if (value === null || value === undefined) {
                return false;
            }
            if (typeof value === 'string') {
                return value.trim().length > 0;
            }
            return true;
        });

        if (filteredEntries.length === 0) {
            return null;
        }

        return Object.fromEntries(filteredEntries);
    }

    private buildPatientName(row: Record<string, string | null>): unknown {
        const displayName = this.pickFirst(row, [
            'patient_name',
            'patient_full_name',
            'full_name',
            'display_name',
            'name',
        ]);
        const firstName = this.pickFirst(row, [
            'patient_first_name',
            'first_name',
            'given_name',
            'given',
        ]);
        const lastName = this.pickFirst(row, [
            'patient_last_name',
            'last_name',
            'family_name',
            'family',
            'surname',
        ]);

        if (!displayName && !firstName && !lastName) {
            return null;
        }

        if (displayName) {
            const parsedStructuredName = this.tryParseStructuredName(displayName);
            if (parsedStructuredName) {
                return parsedStructuredName;
            }
            return [{ text: displayName }];
        }

        return [{ given: firstName ? [firstName] : [], family: lastName ?? '' }];
    }

    private tryParseStructuredName(value: string): unknown[] | null {
        const trimmed = value.trim();
        if (!trimmed || (!trimmed.startsWith('[') && !trimmed.startsWith('{'))) {
            return null;
        }

        try {
            const parsed = JSON.parse(trimmed) as unknown;
            if (Array.isArray(parsed)) {
                const hasFhirNameShape = parsed.some(
                    (entry) =>
                        entry &&
                        typeof entry === 'object' &&
                        ('text' in entry || 'given' in entry || 'family' in entry),
                );
                return hasFhirNameShape ? parsed : null;
            }

            if (
                parsed &&
                typeof parsed === 'object' &&
                ('text' in parsed || 'given' in parsed || 'family' in parsed)
            ) {
                return [parsed];
            }
        } catch {
            return null;
        }

        return null;
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

    private buildPractitionerName(row: Record<string, string | null>): unknown {
        const displayName = this.pickFirst(row, [
            'practitioner_name',
            'provider_name',
            'name',
        ]);
        const firstName = this.pickFirst(row, [
            'practitioner_first_name',
            'first_name',
        ]);
        const lastName = this.pickFirst(row, [
            'practitioner_last_name',
            'last_name',
            'family_name',
            'surname',
        ]);

        if (!displayName && !firstName && !lastName) {
            return null;
        }

        if (displayName) {
            return [{ text: displayName }];
        }

        return [{ given: firstName ? [firstName] : [], family: lastName ?? '' }];
    }

    private buildCodeableConcept(
        display: string | null,
        code: string | null,
    ): unknown {
        if (!display && !code) {
            return null;
        }

        const codingEntry: Record<string, unknown> = {};
        if (code) {
            codingEntry.code = code;
        }
        if (display) {
            codingEntry.display = display;
        }

        const concept: Record<string, unknown> = {};
        if (display) {
            concept.text = display;
        }
        if (Object.keys(codingEntry).length > 0) {
            concept.coding = [codingEntry];
        }

        return [concept];
    }

    private buildQuantity(
        rawValue: string | null,
        unit: string | null,
    ): Record<string, unknown> | null {
        if (!rawValue && !unit) {
            return null;
        }

        const quantity: Record<string, unknown> = {};
        if (rawValue) {
            const numeric = Number(rawValue);
            quantity.value = Number.isFinite(numeric) ? numeric : rawValue;
        }
        if (unit) {
            quantity.unit = unit;
        }

        return quantity;
    }
}
