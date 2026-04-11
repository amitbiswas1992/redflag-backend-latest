import { pgTable, text, timestamp, uuid, jsonb, integer, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './identity';

export const ingestionJobStatusEnum = pgEnum('ingestion_job_status', [
    'CREATED',
    'UPLOADED',
    'RUNNING',
    'COMPLETED',
    'FAILED'
]);

export const ingestionRowOutcomeEnum = pgEnum('ingestion_row_outcome', [
    'INSERTED',
    'UPDATED',
    'SKIPPED',
    'ERROR'
]);

export const ingestionJobs = pgTable('ingestion_jobs', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    sourceType: text('source_type').notNull(),
    templateVersion: text('template_version'),
    status: ingestionJobStatusEnum('status').default('CREATED').notNull(),
    checksumSha256: text('checksum_sha256'),
    totalRows: integer('total_rows').default(0).notNull(),
    processedRows: integer('processed_rows').default(0).notNull(),
    successRows: integer('success_rows').default(0).notNull(),
    failedRows: integer('failed_rows').default(0).notNull(),
    mappingManifest: jsonb('mapping_manifest'),
    errorSummary: jsonb('error_summary'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ingestionRowResults = pgTable('ingestion_row_results', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    jobId: uuid('job_id').references(() => ingestionJobs.id, { onDelete: 'cascade' }).notNull(),
    rowNumber: integer('row_number').notNull(),
    sourceRecordKey: text('source_record_key'),
    entityType: text('entity_type'),
    outcome: ingestionRowOutcomeEnum('outcome').notNull(),
    reasonCode: text('reason_code'),
    message: text('message'),
    rowData: jsonb('row_data'),
    persisted: jsonb('persisted'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('unq_org_job_row').on(table.organizationId, table.jobId, table.rowNumber)
]);

export const ingestionStats = pgTable('ingestion_stats', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    date: timestamp('date').defaultNow().notNull(),
    source: text('source'),
    patients: integer('patients').default(0).notNull(),
    observations: integer('observations').default(0).notNull(),
    conditions: integer('conditions').default(0).notNull(),
    allergies: integer('allergies').default(0).notNull(),
    medications: integer('medications').default(0).notNull(),
    procedures: integer('procedures').default(0).notNull(),
    encounters: integer('encounters').default(0).notNull(),
    diagnosticReports: integer('diagnostic_reports').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
