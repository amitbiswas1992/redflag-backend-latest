import {
    encounters,
    ingestionJobs,
    ingestionRowResults,
    patients,
    rawFhirIngestions,
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

const dbMock = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
};

jest.mock('@app/db', () => ({
    db: dbMock,
    ingestionJobs: ingestionJobsTable,
    ingestionRowResults: ingestionRowResultsTable,
    rawFhirIngestions: rawFhirIngestionsTable,
    patients: patientsTable,
    encounters: encountersTable,
}));

jest.mock('drizzle-orm', () => ({
    and: jest.fn((...args: unknown[]) => ({ and: args })),
    asc: jest.fn((arg: unknown) => ({ asc: arg })),
    count: jest.fn(() => ({ count: true })),
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
    dbMock.select.mockImplementation(() => ({
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

function configureInsertMocks() {
    dbMock.insert.mockImplementation((table: unknown) => {
        if (table === patients) {
            return {
                values: jest.fn(() => ({
                    onConflictDoUpdate: jest.fn(() => ({
                        returning: jest.fn().mockResolvedValue([{ id: 'pat-db-id' }]),
                    })),
                })),
            };
        }

        if (table === encounters) {
            return {
                values: jest.fn(() => ({
                    onConflictDoUpdate: jest.fn(() => ({
                        returning: jest.fn().mockResolvedValue([{ id: 'enc-db-id' }]),
                    })),
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
    dbMock.update.mockImplementation((table: unknown) => ({
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

        dbMock.transaction.mockImplementation(
            (callback: (trx: typeof tx) => Promise<void>) => callback(tx),
        );

        const service = new IngestionService(
            queueServiceMock as never,
            { organizationId: 'org-a' } as never,
        );

        await service.uploadCsv('job-1', {
            csvData: [
                'patient_epic_id,patient_name,encounter_epic_id',
                'p-1,John Doe,e-1',
                ',Missing Patient,e-2',
            ].join('\n'),
        });

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
                        patient_name: 'Jane Roe',
                        patient_dob: '1980-01-01',
                        encounter_epic_id: 'enc-100',
                        encounter_status: 'finished',
                        encounter_type: 'Emergency',
                    },
                    entityType: 'PATIENT',
                },
            ],
            [],
            [],
            [{ failedRows: 0 }],
            [{ totalRows: 1 }],
        ]);

        configureInsertMocks();

        const updateCalls: Array<{
            table: unknown;
            values: Record<string, unknown>;
        }> = [];
        configureUpdateCapture(updateCalls);

        const worker = new IngestionWorkerService();
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
        expect(errorSummary?.ENCOUNTER_INSERTED).toBe(1);

        const drizzleUnknown: unknown = jest.requireMock('drizzle-orm');
        const drizzleRecord = drizzleUnknown as Record<string, unknown>;
        const eqMock = drizzleRecord.eq as jest.Mock;
        expect(eqMock).toHaveBeenCalledWith(ingestionJobs.organizationId, 'org-a');
        expect(eqMock).toHaveBeenCalledWith(patients.organizationId, 'org-a');
        expect(eqMock).toHaveBeenCalledWith(encounters.organizationId, 'org-a');
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
        ]);

        configureInsertMocks();

        const updateCalls: Array<{
            table: unknown;
            values: Record<string, unknown>;
        }> = [];
        configureUpdateCapture(updateCalls);

        const worker = new IngestionWorkerService();
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
});
