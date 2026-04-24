import {
    allergies,
    auditLogs,
    complianceFlags,
    conditions,
    diagnosticReports,
    encounterAnalytics,
    encounters,
    ingestionJobs,
    ingestionRowResults,
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
import { IngestionWorkerService } from './ingestion-worker.service';
import { IngestionService } from './ingestion.service';

type TableRef = { name: string };

const makeTable = (columns: string[]): Record<string, TableRef> => {
    return Object.fromEntries(
        columns.map((column) => [column, { name: column }]),
    );
};

const ingestionJobsTable = makeTable([
    'id',
    'organizationId',
    'status',
    'mappingManifest',
    'sourceType',
    'createdAt',
    'checksumSha256',
    'totalRows',
    'processedRows',
    'successRows',
    'failedRows',
    'errorSummary',
    'startedAt',
    'completedAt',
    'updatedAt',
]);

const ingestionRowResultsTable = makeTable([
    'id',
    'organizationId',
    'jobId',
    'rowNumber',
    'sourceRecordKey',
    'entityType',
    'outcome',
    'reasonCode',
    'message',
    'rowData',
    'persisted',
]);

const rawFhirIngestionsTable = makeTable([
    'id',
    'organizationId',
    'jobId',
    'rowNumber',
    'sourceRecordKey',
    'rawPayloadJson',
]);

const patientsTable = makeTable([
    'id',
    'organizationId',
    'sourceId',
    'name',
    'gender',
    'birthDate',
    'updatedAt',
]);

const encountersTable = makeTable([
    'id',
    'organizationId',
    'sourceId',
    'patientId',
    'status',
    'type',
    'updatedAt',
]);

const practitionersTable = makeTable([
    'id',
    'organizationId',
    'sourceId',
    'name',
    'gender',
    'birthDate',
    'updatedAt',
]);

const observationsTable = makeTable([
    'id',
    'organizationId',
    'sourceId',
    'patientId',
    'status',
    'code',
    'effectiveDateTime',
    'updatedAt',
]);

const conditionsTable = makeTable([
    'id',
    'organizationId',
    'sourceId',
    'patientId',
    'clinicalStatus',
    'code',
    'onsetDateTime',
    'updatedAt',
]);

const medicationsTable = makeTable([
    'id',
    'organizationId',
    'sourceId',
    'patientId',
    'status',
    'medicationCodeableConcept',
    'updatedAt',
]);

const allergiesTable = makeTable([
    'id',
    'organizationId',
    'sourceId',
    'patientId',
    'status',
    'code',
    'updatedAt',
]);

const proceduresTable = makeTable([
    'id',
    'organizationId',
    'sourceId',
    'patientId',
    'status',
    'code',
    'updatedAt',
]);

const diagnosticReportsTable = makeTable([
    'id',
    'organizationId',
    'sourceId',
    'patientId',
    'status',
    'code',
    'updatedAt',
]);

const substancesTable = makeTable([
    'id',
    'organizationId',
    'sourceId',
    'patientId',
    'encounterId',
    'status',
    'code',
    'updatedAt',
]);

const encounterAnalyticsTable = makeTable([
    'id',
    'organizationId',
    'encounterId',
    'isTelehealth',
    'crossStateFlag',
    'updatedAt',
]);

const medicationAnalyticsTable = makeTable([
    'id',
    'organizationId',
    'medicationId',
    'controlledSubstance',
    'deaSchedule',
    'updatedAt',
]);

const complianceFlagsTable = makeTable([
    'id',
    'organizationId',
    'entityType',
    'entityId',
    'flagType',
    'severity',
    'description',
    'updatedAt',
]);

const riskScoresTable = makeTable([
    'id',
    'organizationId',
    'entityType',
    'entityId',
    'complianceScore',
    'riskLevel',
    'category',
    'updatedAt',
]);

const auditLogsTable = makeTable([
    'id',
    'organizationId',
    'actorType',
    'actorId',
    'action',
    'resourceType',
    'resourceId',
    'changes',
]);

const dbMockState = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
};

function getDbMock() {
    return dbMockState;
}

jest.mock('@app/db', () => {
    const mockedModule: Record<string, unknown> = {};

    Object.defineProperties(mockedModule, {
        db: { get: () => getDbMock() },
        ingestionJobs: { get: () => ingestionJobsTable },
        ingestionRowResults: { get: () => ingestionRowResultsTable },
        rawFhirIngestions: { get: () => rawFhirIngestionsTable },
        patients: { get: () => patientsTable },
        practitioners: { get: () => practitionersTable },
        encounters: { get: () => encountersTable },
        observations: { get: () => observationsTable },
        conditions: { get: () => conditionsTable },
        medications: { get: () => medicationsTable },
        substances: { get: () => substancesTable },
        allergies: { get: () => allergiesTable },
        procedures: { get: () => proceduresTable },
        diagnosticReports: { get: () => diagnosticReportsTable },
        encounterAnalytics: { get: () => encounterAnalyticsTable },
        medicationAnalytics: { get: () => medicationAnalyticsTable },
        complianceFlags: { get: () => complianceFlagsTable },
        riskScores: { get: () => riskScoresTable },
        auditLogs: { get: () => auditLogsTable },
    });

    return mockedModule;
});

jest.mock('drizzle-orm', () => ({
    and: jest.fn((...args: unknown[]) => ({ and: args })),
    asc: jest.fn((arg: unknown) => ({ asc: arg })),
    count: jest.fn(() => ({ count: true })),
    inArray: jest.fn((left: unknown, right: unknown[]) => ({ left, right })),
    eq: jest.fn((left: unknown, right: unknown) => ({ left, right })),
}));

const queueServiceMock = {
    enqueueIngestionJob: jest.fn(),
    getProgress: jest.fn(() => ({ total: 0, processed: 0, status: 'UNKNOWN' })),
};

function makeTerminalResult(value: unknown) {
    return {
        limit: jest.fn().mockResolvedValue(value),
        orderBy: jest.fn().mockResolvedValue(value),
        then: (
            onFulfilled: (resolvedValue: unknown) => unknown,
            onRejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(value).then(onFulfilled, onRejected),
    };
}

function queueSelectResults(results: unknown[]) {
    dbMockState.select.mockImplementation(() => ({
        from: jest.fn(() => {
            const current = results.shift();
            if (current === undefined) {
                throw new Error('Unexpected select call in test');
            }

            return {
                where: jest.fn(() => makeTerminalResult(current)),
                limit: jest.fn(() => Promise.resolve(current)),
                orderBy: jest.fn(() => Promise.resolve(current)),
            };
        }),
    }));
}

function configureInsertMocks(capture?: {
    patientValues?: Array<Record<string, unknown>>;
    encounterValues?: Array<Record<string, unknown>>;
    patientConflictSets?: Array<Record<string, unknown>>;
}) {
    dbMockState.insert.mockImplementation((table: unknown) => {
        if (table === patients) {
            return {
                values: jest.fn((values: Record<string, unknown>) => {
                    capture?.patientValues?.push(values);
                    return {
                        onConflictDoUpdate: jest.fn(
                            (args: { set: Record<string, unknown> }) => {
                                capture?.patientConflictSets?.push(args.set);
                                return {
                                    returning: jest.fn().mockResolvedValue([{ id: 'pat-db-id' }]),
                                };
                            },
                        ),
                    };
                }),
            };
        }

        if (table === encounters) {
            return {
                values: jest.fn((values: Record<string, unknown>) => {
                    capture?.encounterValues?.push(values);
                    return {
                        onConflictDoUpdate: jest.fn(() => ({
                            returning: jest.fn().mockResolvedValue([{ id: 'enc-db-id' }]),
                        })),
                    };
                }),
            };
        }

        if (table === practitioners) {
            return {
                values: jest.fn(() => ({
                    onConflictDoUpdate: jest.fn(() => ({
                        returning: jest.fn().mockResolvedValue([{ id: 'prac-db-id' }]),
                    })),
                })),
            };
        }

        if (table === observations) {
            return {
                values: jest.fn(() => ({
                    onConflictDoUpdate: jest.fn(() => ({
                        returning: jest.fn().mockResolvedValue([{ id: 'obs-db-id' }]),
                    })),
                })),
            };
        }

        if (table === conditions) {
            return {
                values: jest.fn(() => ({
                    onConflictDoUpdate: jest.fn(() => ({
                        returning: jest.fn().mockResolvedValue([{ id: 'cond-db-id' }]),
                    })),
                })),
            };
        }

        if (table === medications) {
            return {
                values: jest.fn(() => ({
                    onConflictDoUpdate: jest.fn(() => ({
                        returning: jest.fn().mockResolvedValue([{ id: 'med-db-id' }]),
                    })),
                })),
            };
        }

        if (table === substances) {
            return {
                values: jest.fn(() => ({
                    onConflictDoUpdate: jest.fn(() => ({
                        returning: jest.fn().mockResolvedValue([{ id: 'sub-db-id' }]),
                    })),
                })),
            };
        }

        if (table === allergies) {
            return {
                values: jest.fn(() => ({
                    onConflictDoUpdate: jest.fn(() => ({
                        returning: jest.fn().mockResolvedValue([{ id: 'all-db-id' }]),
                    })),
                })),
            };
        }

        if (table === procedures) {
            return {
                values: jest.fn(() => ({
                    onConflictDoUpdate: jest.fn(() => ({
                        returning: jest.fn().mockResolvedValue([{ id: 'proc-db-id' }]),
                    })),
                })),
            };
        }

        if (table === diagnosticReports) {
            return {
                values: jest.fn(() => ({
                    onConflictDoUpdate: jest.fn(() => ({
                        returning: jest.fn().mockResolvedValue([{ id: 'dr-db-id' }]),
                    })),
                })),
            };
        }

        if (table === encounterAnalytics) {
            return {
                values: jest.fn(() => ({
                    onConflictDoUpdate: jest.fn(() => ({
                        returning: jest.fn().mockResolvedValue([{ id: 'enca-db-id' }]),
                    })),
                })),
            };
        }

        if (table === medicationAnalytics) {
            return {
                values: jest.fn(() => ({
                    onConflictDoUpdate: jest.fn(() => ({
                        returning: jest.fn().mockResolvedValue([{ id: 'meda-db-id' }]),
                    })),
                })),
            };
        }

        if (table === complianceFlags) {
            return {
                values: jest.fn(() => ({
                    returning: jest.fn().mockResolvedValue([{ id: 'flag-db-id' }]),
                })),
            };
        }

        if (table === riskScores) {
            return {
                values: jest.fn(() => ({
                    returning: jest.fn().mockResolvedValue([{ id: 'risk-db-id' }]),
                })),
            };
        }

        if (table === auditLogs) {
            return {
                values: jest.fn(() => ({
                    returning: jest.fn().mockResolvedValue([{ id: 'audit-db-id' }]),
                })),
            };
        }

        return {
            values: jest.fn(() => Promise.resolve(undefined)),
        };
    });
}

function configureUpdateCapture(
    capturedUpdates: Array<{ table: unknown; values: Record<string, unknown> }>,
) {
    dbMockState.update.mockImplementation((table: unknown) => ({
        set: jest.fn((values: Record<string, unknown>) => ({
            where: jest.fn(() => {
                capturedUpdates.push({ table, values });
                return Promise.resolve(undefined);
            }),
        })),
    }));
}

describe('Ingestion materialization integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('writes every uploaded CSV row into raw_fhir_ingestions', async () => {
        queueSelectResults([
            [
                {
                    id: 'job-1',
                    organizationId: 'org-a',
                    status: 'CREATED',
                    mappingManifest: null,
                },
            ],
        ]);

        const txInsertCalls: Array<{ table: unknown; values: unknown }> = [];
        const tx = {
            delete: jest.fn(() => ({
                where: jest.fn().mockResolvedValue(undefined),
            })),
            insert: jest.fn((table: unknown) => ({
                values: jest.fn((values: unknown) => {
                    txInsertCalls.push({ table, values });
                    return Promise.resolve(undefined);
                }),
            })),
            update: jest.fn(() => ({
                set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
            })),
        };

        dbMockState.transaction.mockImplementation(
            (callback: (trx: typeof tx) => Promise<void>) => callback(tx),
        );
        dbMockState.update.mockImplementation(() => ({
            set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
        }));

        const service = new IngestionService(
            queueServiceMock as never,
            { organizationId: 'org-a' } as never,
        );

        const uploadResult = await service.uploadCsv('job-1', {
            csvData: [
                'patient_epic_id,patient_name,encounter_epic_id',
                'p-1,John Doe,e-1',
                ',Missing Patient,e-2',
            ].join('\n'),
        });

        expect(uploadResult.status).toBe('AWAITING_CONFIRMATION');
        expect(uploadResult.templateDetection.templateVersion).toBe(
            'EPIC_FLAT_FHIR_V1',
        );

        const rawInsert = txInsertCalls.find(
            (call) => call.table === rawFhirIngestions,
        );

        expect(rawInsert).toBeDefined();
        const values = rawInsert?.values as Array<Record<string, unknown>>;
        expect(values).toHaveLength(2);
        expect(values[0].organizationId).toBe('org-a');
        expect(values[0].jobId).toBe('job-1');
        expect(values[0].rowNumber).toBe(1);
        expect(values[1].rowNumber).toBe(2);
    });

    it('materializes valid rows into tenant-scoped patient and encounter upserts', async () => {
        queueSelectResults([
            [{ id: 'job-2', errorSummary: null }],
            [
                {
                    id: 'row-1',
                    rowNumber: 1,
                    outcome: 'INSERTED',
                    rowData: {
                        patient_epic_id: 'pat-100',
                        practitioner_epic_id: 'pract-100',
                        practitioner_name: 'Dr. Carter',
                        given_name: 'Jane',
                        family_name: 'Roe',
                        patient_dob: '1980-01-01',
                        encounter_epic_id: 'enc-100',
                        encounter_status: 'finished',
                        encounter_type: 'Emergency',
                        observation_id: 'obs-100',
                        observation_test_name: 'Blood Pressure',
                        observation_value: '120/80',
                        condition_id: 'cond-100',
                        condition_diagnosis: 'Hypertension',
                        medication_request_id: 'med-100',
                        medication_name: 'Metformin',
                        medication_status: 'active',
                        controlled_substance_prescribed: 'true',
                        dea_schedule: 'II',
                        prescriber_dea: 'AB1234567',
                        auto_refill_enabled: 'false',
                        refill_count: '0',
                        substance_id: 'sub-100',
                        substance_status: 'active',
                        substance_code: 'S-123',
                        substance_code_display: 'Substance 123',
                        substance_category: 'allergen',
                        substance_quantity_value: '4',
                        substance_quantity_unit: 'mg',
                        session_duration: '45',
                        is_telehealth: 'true',
                        hipaa_compliant_platform: 'true',
                        patient_identity_verified: 'true',
                        session_recording_consent: 'true',
                        clinical_notes_completed: 'true',
                        provider_location_state: 'TX',
                        patient_location_state: 'CA',
                        state_licensure_verified: 'true',
                        allergy_id: 'all-100',
                        allergy_allergen: 'Penicillin',
                        allergy_status: 'active',
                        procedure_id: 'proc-100',
                        procedure_name: 'Echocardiogram',
                        procedure_status: 'completed',
                        diagnostic_report_id: 'dr-100',
                        diagnostic_report_name: 'CMP',
                        diagnostic_report_status: 'final',
                    },
                    entityType: 'PATIENT',
                },
            ],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            [{ failedRows: 0 }],
            [{ totalRows: 1 }],
            [{ rawRows: 1 }],
            [{ availableEncounterProjections: 1 }],
            [{ availableMedicationProjections: 1 }],
        ]);

        const patientValues: Array<Record<string, unknown>> = [];
        configureInsertMocks({ patientValues });

        const updateCalls: Array<{
            table: unknown;
            values: Record<string, unknown>;
        }> = [];
        configureUpdateCapture(updateCalls);

        const worker = new IngestionWorkerService({ evaluateJob: async () => ({ rulesEvaluated: 0, flagsInserted: 0, encounterRulesCompiled: 0, medicationRulesCompiled: 0 }) } as any);
        await worker.processQueuedJob('job-2', 'org-a');

        const rowUpdate = updateCalls.find(
            (call) => call.table === ingestionRowResults,
        );
        expect(rowUpdate).toBeDefined();
        expect(rowUpdate?.values.outcome).toBe('INSERTED');
        const persisted = rowUpdate?.values.persisted as Record<string, unknown>;
        expect((persisted.patient as Record<string, unknown>).id).toBe('pat-db-id');
        expect((persisted.encounter as Record<string, unknown>).id).toBe(
            'enc-db-id',
        );
        expect((persisted.practitioner as Record<string, unknown>).id).toBe(
            'prac-db-id',
        );
        expect((persisted.observation as Record<string, unknown>).id).toBe(
            'obs-db-id',
        );
        expect((persisted.condition as Record<string, unknown>).id).toBe(
            'cond-db-id',
        );
        expect((persisted.medication as Record<string, unknown>).id).toBe(
            'med-db-id',
        );
        expect((persisted.substance as Record<string, unknown>).id).toBe(
            'sub-db-id',
        );
        expect((persisted.allergy as Record<string, unknown>).id).toBe('all-db-id');
        expect((persisted.procedure as Record<string, unknown>).id).toBe(
            'proc-db-id',
        );
        expect((persisted.diagnosticReport as Record<string, unknown>).id).toBe(
            'dr-db-id',
        );
        expect((persisted.encounterAnalytics as Record<string, unknown>).id).toBe(
            'enca-db-id',
        );
        expect((persisted.medicationAnalytics as Record<string, unknown>).id).toBe(
            'meda-db-id',
        );
        expect((persisted.compliance as Record<string, unknown>).riskScoreId).toBe(
            'risk-db-id',
        );
        expect((persisted.compliance as Record<string, unknown>).auditLogId).toBe(
            'audit-db-id',
        );
        expect((persisted.compliance as Record<string, unknown>).riskLevel).toBe(
            'LOW',
        );

        const jobUpdate = updateCalls.find(
            (call) =>
                call.table === ingestionJobs && call.values.status === 'COMPLETED',
        );

        expect(jobUpdate).toBeDefined();
        expect(jobUpdate?.values.successRows).toBe(1);
        expect(jobUpdate?.values.failedRows).toBe(0);
        const errorSummary = jobUpdate?.values.errorSummary as
            | Record<string, unknown>
            | undefined;
        expect(errorSummary?.PATIENT_INSERTED).toBe(1);
        expect(errorSummary?.PRACTITIONER_INSERTED).toBe(1);
        expect(errorSummary?.ENCOUNTER_INSERTED).toBe(1);
        expect(errorSummary?.OBSERVATION_INSERTED).toBe(1);
        expect(errorSummary?.CONDITION_INSERTED).toBe(1);
        expect(errorSummary?.MEDICATION_INSERTED).toBe(1);
        expect(errorSummary?.SUBSTANCE_INSERTED).toBe(1);
        expect(errorSummary?.ALLERGY_INSERTED).toBe(1);
        expect(errorSummary?.PROCEDURE_INSERTED).toBe(1);
        expect(errorSummary?.DIAGNOSTIC_REPORT_INSERTED).toBe(1);
        expect(errorSummary?.ENCOUNTER_ANALYTICS_INSERTED).toBe(1);
        expect(errorSummary?.MEDICATION_ANALYTICS_INSERTED).toBe(1);
        expect(errorSummary?.COMPLIANCE_FLAG_INSERTED).toBe(0);
        expect(errorSummary?.RISK_SCORE_INSERTED).toBe(1);
        expect(errorSummary?.AUDIT_LOG_INSERTED).toBe(1);
        expect(patientValues).toHaveLength(1);
        expect(patientValues[0].name).toEqual([{ given: ['Jane'], family: 'Roe' }]);

        const drizzleUnknown: unknown = jest.requireMock('drizzle-orm');
        const drizzleRecord = drizzleUnknown as Record<string, unknown>;
        const eqMock = drizzleRecord.eq as jest.Mock;
        expect(eqMock).toHaveBeenCalledWith(ingestionJobs.organizationId, 'org-a');
        expect(eqMock).toHaveBeenCalledWith(patients.organizationId, 'org-a');
        expect(eqMock).toHaveBeenCalledWith(practitioners.organizationId, 'org-a');
        expect(eqMock).toHaveBeenCalledWith(encounters.organizationId, 'org-a');
        expect(eqMock).toHaveBeenCalledWith(observations.organizationId, 'org-a');
        expect(eqMock).toHaveBeenCalledWith(conditions.organizationId, 'org-a');
        expect(eqMock).toHaveBeenCalledWith(medications.organizationId, 'org-a');
        expect(eqMock).toHaveBeenCalledWith(substances.organizationId, 'org-a');
        expect(eqMock).toHaveBeenCalledWith(allergies.organizationId, 'org-a');
        expect(eqMock).toHaveBeenCalledWith(procedures.organizationId, 'org-a');
        expect(eqMock).toHaveBeenCalledWith(
            diagnosticReports.organizationId,
            'org-a',
        );
        expect(eqMock).toHaveBeenCalledWith(
            encounterAnalytics.organizationId,
            'org-a',
        );
        expect(eqMock).toHaveBeenCalledWith(
            medicationAnalytics.organizationId,
            'org-a',
        );
    });

    it('keeps invalid rows as ERROR and increments failed counters', async () => {
        queueSelectResults([
            [{ id: 'job-3', errorSummary: null }],
            [
                {
                    id: 'row-1',
                    rowNumber: 1,
                    outcome: 'INSERTED',
                    rowData: {
                        patient_name: 'No Source ID',
                    },
                    entityType: 'PATIENT',
                },
            ],
            [{ failedRows: 1 }],
            [{ totalRows: 1 }],
            [{ rawRows: 1 }],
        ]);

        configureInsertMocks();

        const updateCalls: Array<{
            table: unknown;
            values: Record<string, unknown>;
        }> = [];
        configureUpdateCapture(updateCalls);

        const worker = new IngestionWorkerService({ evaluateJob: async () => ({ rulesEvaluated: 0, flagsInserted: 0, encounterRulesCompiled: 0, medicationRulesCompiled: 0 }) } as any);
        await worker.processQueuedJob('job-3', 'org-a');

        const errorRowUpdate = updateCalls.find(
            (call) =>
                call.table === ingestionRowResults &&
                call.values.reasonCode === 'PERSIST_ERROR',
        );

        expect(errorRowUpdate).toBeDefined();

        const jobUpdate = updateCalls.find(
            (call) =>
                call.table === ingestionJobs && call.values.status === 'COMPLETED',
        );

        expect(jobUpdate).toBeDefined();
        expect(jobUpdate?.values.failedRows).toBe(1);
        expect(jobUpdate?.values.successRows).toBe(0);
    });

    it('does not overwrite existing patient name when incoming row has no name fields', async () => {
        queueSelectResults([
            [{ id: 'job-4', errorSummary: null }],
            [
                {
                    id: 'row-1',
                    rowNumber: 1,
                    outcome: 'INSERTED',
                    rowData: {
                        patient_epic_id: 'pat-200',
                        encounter_epic_id: 'enc-200',
                        encounter_status: 'finished',
                    },
                    entityType: 'PATIENT',
                },
            ],
            [{ id: 'existing-patient-id' }],
            [],
            [],
            [{ failedRows: 0 }],
            [{ totalRows: 1 }],
            [{ rawRows: 1 }],
            [{ availableEncounterProjections: 1 }],
        ]);

        const patientConflictSets: Array<Record<string, unknown>> = [];
        configureInsertMocks({ patientConflictSets });

        const updateCalls: Array<{
            table: unknown;
            values: Record<string, unknown>;
        }> = [];
        configureUpdateCapture(updateCalls);

        const worker = new IngestionWorkerService({ evaluateJob: async () => ({ rulesEvaluated: 0, flagsInserted: 0, encounterRulesCompiled: 0, medicationRulesCompiled: 0 }) } as any);
        await worker.processQueuedJob('job-4', 'org-a');

        expect(patientConflictSets).toHaveLength(1);
        expect(patientConflictSets[0]).not.toHaveProperty('name');
    });
});
