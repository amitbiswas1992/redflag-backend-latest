import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { db, ingestionJobs, ingestionRowResults } from '@app/db';
import { and, asc, count, eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { normalizeDateValue } from './date-normalizer';
import { parseCsvRows, ParsedCsvRow } from './csv';
import {
  createJobRequestSchema,
  mappingManifestSchema,
  normalizedCsvRowSchema,
  startJobRequestSchema,
  uploadCsvRequestSchema,
  MappingManifest,
} from './schemas';
import { RiskEngineService } from '../risk-engine/risk-engine.service';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly riskEngineService: RiskEngineService,
    @Inject('REQUEST')
    private readonly request: { organizationId?: string; tenantId?: string },
  ) { }

  private get orgId(): string {
    const organizationId = this.request?.organizationId ?? this.request?.tenantId;
    if (!organizationId) throw new BadRequestException('Organization context missing.');
    return organizationId;
  }

  async createJob(rawInput: unknown) {
    const input = createJobRequestSchema.parse(rawInput);

    const inserted = await db
      .insert(ingestionJobs)
      .values({
        organizationId: this.orgId,
        sourceType: input.sourceType,
        templateVersion: input.templateVersion ?? null,
        mappingManifest: input.mappingManifest ?? null,
      })
      .returning({
        id: ingestionJobs.id,
        status: ingestionJobs.status,
        sourceType: ingestionJobs.sourceType,
        createdAt: ingestionJobs.createdAt,
      });

    const [job] = inserted;
    return {
      jobId: job.id,
      status: job.status,
      sourceType: job.sourceType,
      createdAt: job.createdAt,
    };
  }

  async uploadCsv(jobId: string, rawInput: unknown) {
    const input = uploadCsvRequestSchema.parse(rawInput);
    const job = await this.getJobForOrg(jobId);

    if (job.status === 'RUNNING') {
      throw new BadRequestException('Job is currently running. CSV upload is locked.');
    }
    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      throw new BadRequestException('Job is finalized and cannot accept new CSV uploads.');
    }

    const checksumSha256 = createHash('sha256').update(input.csvData).digest('hex');
    const parsedRows = parseCsvRows(input.csvData);
    const mappingManifest = this.parseMappingManifest(job.mappingManifest);

    const rowResults: Array<typeof ingestionRowResults.$inferInsert> = [];
    const errorSummary: Record<string, number> = {};
    let successRows = 0;
    let failedRows = 0;

    parsedRows.forEach((rawRow, index) => {
      const rowNumber = index + 1;
      const normalized = this.normalizeAndValidateRow(rawRow, mappingManifest);

      if (!normalized.ok) {
        failedRows += 1;
        errorSummary[normalized.reasonCode] =
          (errorSummary[normalized.reasonCode] ?? 0) + 1;

        rowResults.push({
          organizationId: this.orgId,
          jobId,
          rowNumber,
          sourceRecordKey: this.resolveSourceRecordKey(rawRow),
          entityType: 'PATIENT',
          outcome: 'ERROR',
          reasonCode: normalized.reasonCode,
          message: normalized.message,
          rowData: rawRow,
          persisted: null,
        });

        return;
      }

      successRows += 1;
      rowResults.push({
        organizationId: this.orgId,
        jobId,
        rowNumber,
        sourceRecordKey: this.resolveSourceRecordKey(normalized.row),
        entityType: 'PATIENT',
        outcome: 'INSERTED',
        reasonCode: null,
        message: 'Row validated successfully',
        rowData: normalized.row,
        persisted: null,
      });
    });

    const totalRows = parsedRows.length;

    await db.transaction(async (tx) => {
      await tx
        .delete(ingestionRowResults)
        .where(
          and(
            eq(ingestionRowResults.organizationId, this.orgId),
            eq(ingestionRowResults.jobId, jobId),
          ),
        );

      if (rowResults.length > 0) {
        await tx.insert(ingestionRowResults).values(rowResults);
      }

      await tx
        .update(ingestionJobs)
        .set({
          status: 'UPLOADED',
          checksumSha256,
          totalRows,
          processedRows: 0,
          successRows,
          failedRows,
          errorSummary,
          updatedAt: new Date(),
          startedAt: null,
          completedAt: null,
        })
        .where(
          and(
            eq(ingestionJobs.id, jobId),
            eq(ingestionJobs.organizationId, this.orgId),
          ),
        );
    });

    return {
      jobId,
      status: 'UPLOADED',
      checksumSha256,
      totalRows,
      successRows,
      failedRows,
      errorSummary,
    };
  }

  async startJob(jobId: string, rawInput: unknown) {
    startJobRequestSchema.parse(rawInput);
    const existingJob = await this.getJobForOrg(jobId);

    if (existingJob.status !== 'UPLOADED') {
      throw new BadRequestException(
        `Job must be in UPLOADED status before start. Current status: ${existingJob.status}`,
      );
    }

    const startedAt = new Date();

    await db
      .update(ingestionJobs)
      .set({
        status: 'RUNNING',
        startedAt,
        updatedAt: startedAt,
      })
      .where(
        and(eq(ingestionJobs.id, jobId), eq(ingestionJobs.organizationId, this.orgId)),
      );

    try {
      const [{ total }] = await db
        .select({ total: count() })
        .from(ingestionRowResults)
        .where(
          and(
            eq(ingestionRowResults.organizationId, this.orgId),
            eq(ingestionRowResults.jobId, jobId),
          ),
        );

      const [{ failed }] = await db
        .select({ failed: count() })
        .from(ingestionRowResults)
        .where(
          and(
            eq(ingestionRowResults.organizationId, this.orgId),
            eq(ingestionRowResults.jobId, jobId),
            eq(ingestionRowResults.outcome, 'ERROR'),
          ),
        );

      const totalRows = Number(total ?? 0);
      const failedRows = Number(failed ?? 0);
      const successRows = totalRows - failedRows;
      const persistedCount = successRows;
      const completedAt = new Date();

      await db
        .update(ingestionJobs)
        .set({
          status: 'COMPLETED',
          totalRows,
          processedRows: totalRows,
          successRows,
          failedRows,
          completedAt,
          updatedAt: completedAt,
        })
        .where(
          and(
            eq(ingestionJobs.id, jobId),
            eq(ingestionJobs.organizationId, this.orgId),
          ),
        );

      return {
        jobId,
        status: 'COMPLETED',
        totalRows,
        successRows,
        failedRows,
        persistedCount,
        startedAt,
        completedAt,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown ingestion start error';

      await db
        .update(ingestionJobs)
        .set({
          status: 'FAILED',
          errorSummary: { startError: errorMessage },
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(ingestionJobs.id, jobId),
            eq(ingestionJobs.organizationId, this.orgId),
          ),
        );

      this.logger.error(`Failed to start ingestion job ${jobId}: ${errorMessage}`);
      throw error;
    }
  }

  async getJobStatus(jobId: string) {
    const job = await this.getJobForOrg(jobId);
    return {
      id: job.id,
      status: job.status,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      successRows: job.successRows,
      failedRows: job.failedRows,
      errorSummary: job.errorSummary,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  async getRowResults(jobId: string, page = 1, pageSize = 50) {
    if (page < 1) {
      throw new BadRequestException('page must be >= 1');
    }
    if (pageSize < 1 || pageSize > 500) {
      throw new BadRequestException('pageSize must be between 1 and 500');
    }

    await this.getJobForOrg(jobId);

    const offset = (page - 1) * pageSize;
    const [{ total }] = await db
      .select({ total: count() })
      .from(ingestionRowResults)
      .where(
        and(
          eq(ingestionRowResults.organizationId, this.orgId),
          eq(ingestionRowResults.jobId, jobId),
        ),
      );

    const rows = await db
      .select({
        rowNumber: ingestionRowResults.rowNumber,
        sourceRecordKey: ingestionRowResults.sourceRecordKey,
        entityType: ingestionRowResults.entityType,
        outcome: ingestionRowResults.outcome,
        reasonCode: ingestionRowResults.reasonCode,
        message: ingestionRowResults.message,
        rowData: ingestionRowResults.rowData,
      })
      .from(ingestionRowResults)
      .where(
        and(
          eq(ingestionRowResults.organizationId, this.orgId),
          eq(ingestionRowResults.jobId, jobId),
        ),
      )
      .orderBy(asc(ingestionRowResults.rowNumber))
      .limit(pageSize)
      .offset(offset);

    return {
      page,
      pageSize,
      total: Number(total ?? 0),
      rows,
    };
  }

  private async getJobForOrg(jobId: string) {
    const jobs = await db
      .select()
      .from(ingestionJobs)
      .where(and(eq(ingestionJobs.id, jobId), eq(ingestionJobs.organizationId, this.orgId)))
      .limit(1);

    const [job] = jobs;
    if (!job) {
      throw new NotFoundException('Ingestion job not found');
    }

    return job;
  }

  private parseMappingManifest(rawManifest: unknown): MappingManifest | null {
    if (!rawManifest) {
      return null;
    }

    const parsedManifest = mappingManifestSchema.safeParse(rawManifest);
    if (!parsedManifest.success) {
      throw new BadRequestException('Stored mapping manifest is invalid for this ingestion job.');
    }

    return parsedManifest.data;
  }

  private normalizeAndValidateRow(
    rawRow: ParsedCsvRow,
    mappingManifest: MappingManifest | null,
  ):
    | { ok: true; row: ParsedCsvRow }
    | { ok: false; reasonCode: string; message: string } {
    const structuralResult = normalizedCsvRowSchema.safeParse(rawRow);
    if (!structuralResult.success) {
      const firstIssue = structuralResult.error.issues[0];
      return {
        ok: false,
        reasonCode: 'INVALID_ROW',
        message: firstIssue?.message ?? 'Row does not satisfy ingestion schema',
      };
    }

    if (!mappingManifest?.dateColumns) {
      return { ok: true, row: structuralResult.data };
    }

    const normalizedRow: ParsedCsvRow = { ...structuralResult.data };
    for (const [columnName, dateRule] of Object.entries(mappingManifest.dateColumns)) {
      const currentValue = normalizedRow[columnName];
      const normalizedDate = normalizeDateValue(currentValue, dateRule);
      if (!normalizedDate.success) {
        return {
          ok: false,
          reasonCode: normalizedDate.code,
          message: `${columnName}: ${normalizedDate.message}`,
        };
      }

      normalizedRow[columnName] = normalizedDate.normalized || null;
    }

    return { ok: true, row: normalizedRow };
  }

  private resolveSourceRecordKey(row: ParsedCsvRow): string | undefined {
    const candidateKeys = [
      'patient_epic_id',
      'patient_id',
      'patientepicid',
      'patientid',
      'encounter_id',
      'encounterid',
    ];

    for (const key of candidateKeys) {
      const value = row[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return undefined;
  }
}
