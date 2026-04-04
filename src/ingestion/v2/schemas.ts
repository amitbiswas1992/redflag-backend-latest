import { z } from 'zod';

export const supportedDateFormats = [
    'ISO_8601',
    'YYYY_MM_DD',
    'MM_DD_YYYY',
    'DD_MM_YYYY',
    'UNIX_SECONDS',
    'UNIX_MILLISECONDS',
    'EXCEL_SERIAL',
] as const;

export const dateColumnRuleSchema = z.object({
    acceptedFormats: z.array(z.enum(supportedDateFormats)).min(1),
    outputType: z.enum(['date', 'datetime']),
    timezone: z.string().min(1).default('UTC'),
    nullable: z.boolean().default(true),
});

export const mappingManifestSchema = z.object({
    schemaVersion: z.string().min(1),
    family: z.literal('FLAT_FHIR_CSV'),
    dateColumns: z.record(z.string(), dateColumnRuleSchema).default({}),
});

export const createJobRequestSchema = z.object({
    sourceType: z.literal('FLAT_FHIR_CSV'),
    templateVersion: z.string().min(1).optional(),
    mappingManifest: mappingManifestSchema.optional(),
});

export const uploadCsvRequestSchema = z.object({
    csvData: z.string().min(1),
});

export const startJobRequestSchema = z.object({
    strictDateParsing: z.boolean().default(true),
});

export const normalizedCsvRowSchema = z
    .record(z.string(), z.union([z.string(), z.null()]))
    .refine(
        (row) => {
            const patientKeys = ['patientepicid', 'patient_epic_id', 'patientid', 'patient_id'];
            return patientKeys.some((key) => {
                const value = row[key];
                return typeof value === 'string' && value.trim().length > 0;
            });
        },
        {
            message: 'patientEpicId is required in row context',
            path: ['patientEpicId'],
        },
    );

export const rowResultSchema = z.object({
    rowNumber: z.number().int().positive(),
    sourceRecordKey: z.string().optional(),
    entityType: z.string().optional(),
    outcome: z.enum(['INSERTED', 'UPDATED', 'SKIPPED', 'ERROR']),
    reasonCode: z.string().optional(),
    message: z.string().optional(),
});

export type DateColumnRule = z.infer<typeof dateColumnRuleSchema>;
export type MappingManifest = z.infer<typeof mappingManifestSchema>;
export type CreateJobRequest = z.infer<typeof createJobRequestSchema>;
export type UploadCsvRequest = z.infer<typeof uploadCsvRequestSchema>;
export type StartJobRequest = z.infer<typeof startJobRequestSchema>;
export type RowResult = z.infer<typeof rowResultSchema>;
