import {
  db,
  ingestionJobs,
  ingestionRowResults,
  rawFhirIngestions,
} from '@app/db';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  MessageEvent,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { and, asc, count, eq } from 'drizzle-orm';
import {
  from,
  interval,
  map,
  Observable,
  startWith,
  switchMap,
  takeWhile,
} from 'rxjs';
import { parseCsvRows, ParsedCsvRow } from './csv';
import { normalizeDateValue } from './date-normalizer';
import { IngestionQueueService } from './ingestion-queue.service';
import {
  confirmTemplateRequestSchema,
  createJobRequestSchema,
  MappingManifest,
  mappingManifestSchema,
  normalizedCsvRowSchema,
  startJobRequestSchema,
  uploadCsvRequestSchema,
} from './schemas';

type TemplateDetectionResult = {
  templateVersion: string;
  confidence: number;
  matchedHeaders: number;
  totalHeaders: number;
};

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly ingestionQueueService: IngestionQueueService,
    @Inject('REQUEST')
    private readonly request: { organizationId?: string; tenantId?: string },
  ) { }

  private get orgId(): string {
    const organizationId =
      this.request?.organizationId ?? this.request?.tenantId;
    if (!organizationId)
      throw new BadRequestException('Organization context missing.');
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
      throw new BadRequestException(
        'Job is currently running. CSV upload is locked.',
      );
    }
    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      throw new BadRequestException(
        'Job is finalized and cannot accept new CSV uploads.',
      );
    }

    const checksumSha256 = createHash('sha256')
      .update(input.csvData)
      .digest('hex');
    const parsedRows = parseCsvRows(input.csvData);
    const detection = this.detectTemplateVersion(parsedRows);
    const mappingManifest = this.parseMappingManifest(job.mappingManifest);

    const rowResults: Array<typeof ingestionRowResults.$inferInsert> = [];
    const rawRows: Array<typeof rawFhirIngestions.$inferInsert> = [];
    const errorSummary: Record<string, number> = {};
    let successRows = 0;
    let failedRows = 0;

    parsedRows.forEach((rawRow, index) => {
      const rowNumber = index + 1;
      const normalized = this.normalizeAndValidateRow(rawRow, mappingManifest);

      rawRows.push({
        organizationId: this.orgId,
        jobId,
        rowNumber,
        sourceRecordKey: this.resolveSourceRecordKey(rawRow),
        rawPayloadJson: rawRow,
      });

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

      await tx
        .delete(rawFhirIngestions)
        .where(
          and(
            eq(rawFhirIngestions.organizationId, this.orgId),
            eq(rawFhirIngestions.jobId, jobId),
          ),
        );

      if (rawRows.length > 0) {
        await tx.insert(rawFhirIngestions).values(rawRows);
      }

      if (rowResults.length > 0) {
        await tx.insert(ingestionRowResults).values(rowResults);
      }

      await tx
        .update(ingestionJobs)
        .set({
          status: 'DETECTING',
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

    await db
      .update(ingestionJobs)
      .set({
        status: 'AWAITING_CONFIRMATION',
        templateVersion: detection.templateVersion,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ingestionJobs.id, jobId),
          eq(ingestionJobs.organizationId, this.orgId),
        ),
      );

    return {
      jobId,
      status: 'AWAITING_CONFIRMATION',
      checksumSha256,
      totalRows,
      successRows,
      failedRows,
      errorSummary,
      templateDetection: detection,
    };
  }

  async confirmTemplate(jobId: string, rawInput: unknown) {
    const input = confirmTemplateRequestSchema.parse(rawInput);
    const job = await this.getJobForOrg(jobId);

    if (job.status === 'UPLOADED') {
      return {
        jobId,
        status: 'UPLOADED',
        templateVersion: job.templateVersion,
      };
    }

    if (job.status !== 'AWAITING_CONFIRMATION') {
      throw new BadRequestException(
        `Job must be in AWAITING_CONFIRMATION before confirming template. Current status: ${job.status}`,
      );
    }

    await db
      .update(ingestionJobs)
      .set({
        status: 'UPLOADED',
        templateVersion: input.acceptedTemplate ?? job.templateVersion,
        mappingManifest: input.mappingManifest ?? job.mappingManifest,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ingestionJobs.id, jobId),
          eq(ingestionJobs.organizationId, this.orgId),
        ),
      );

    return {
      jobId,
      status: 'UPLOADED',
      templateVersion: input.acceptedTemplate ?? job.templateVersion,
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
        processedRows: 0,
        startedAt,
        updatedAt: startedAt,
      })
      .where(
        and(
          eq(ingestionJobs.id, jobId),
          eq(ingestionJobs.organizationId, this.orgId),
        ),
      );

    try {
      const queueJobId = await this.ingestionQueueService.enqueueIngestionJob(
        jobId,
        this.orgId,
      );

      return {
        jobId,
        status: 'RUNNING',
        totalRows: existingJob.totalRows,
        successRows: existingJob.successRows,
        failedRows: existingJob.failedRows,
        persistedCount: 0,
        startedAt,
        completedAt: null,
        queueJobId,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown ingestion start error';

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

      this.logger.error(
        `Failed to start ingestion job ${jobId}: ${errorMessage}`,
      );
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

  async getJobProgress(jobId: string) {
    const job = await this.getJobForOrg(jobId);
    const workerProgress = this.ingestionQueueService.getProgress(jobId);
    const isUnknownProgress = workerProgress.status === 'UNKNOWN';

    return {
      id: job.id,
      status: isUnknownProgress ? job.status : workerProgress.status,
      totalRows: isUnknownProgress ? job.totalRows : workerProgress.total,
      processedRows: isUnknownProgress
        ? job.processedRows
        : workerProgress.processed,
      successRows: job.successRows,
      failedRows: job.failedRows,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      updatedAt: job.updatedAt,
    };
  }

  streamJobProgress(jobId: string): Observable<MessageEvent> {
    return interval(1000).pipe(
      startWith(0),
      switchMap(() => from(this.getJobProgress(jobId))),
      map(
        (progress): MessageEvent => ({
          type: 'progress',
          data: progress,
        }),
      ),
      takeWhile((event) => {
        const payload = event.data as { status?: string };
        return !this.isTerminalJobStatus(payload.status);
      }, true),
    );
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
        persisted: ingestionRowResults.persisted,
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
      .where(
        and(
          eq(ingestionJobs.id, jobId),
          eq(ingestionJobs.organizationId, this.orgId),
        ),
      )
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
      throw new BadRequestException(
        'Stored mapping manifest is invalid for this ingestion job.',
      );
    }

    return parsedManifest.data;
  }

  private detectTemplateVersion(rows: ParsedCsvRow[]): TemplateDetectionResult {
    const headers = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        headers.add(key);
      }
    }

    const fingerprints = [
      {
        templateVersion: 'EPIC_FLAT_FHIR_V1',
        headers: ['patient_epic_id', 'encounter_epic_id', 'medication_request_id'],
      },
      {
        templateVersion: 'CERNER_FLAT_FHIR_V1',
        headers: ['patient_id', 'encounter_id', 'medication_id'],
      },
      {
        templateVersion: 'ORACLE_HEALTH_FLAT_FHIR_V1',
        headers: ['patient_identifier_value', 'encounter_id', 'organization_name'],
      },
    ] as const;

    let winner = {
      templateVersion: 'CUSTOM_FLAT_FHIR',
      confidence: 0,
      matchedHeaders: 0,
      totalHeaders: headers.size,
    };

    for (const candidate of fingerprints) {
      const matched = candidate.headers.filter((header) => headers.has(header)).length;
      const confidence = candidate.headers.length
        ? matched / candidate.headers.length
        : 0;

      if (confidence > winner.confidence) {
        winner = {
          templateVersion: candidate.templateVersion,
          confidence,
          matchedHeaders: matched,
          totalHeaders: headers.size,
        };
      }
    }

    return winner;
  }

  private isTerminalJobStatus(status?: string): boolean {
    return (
      status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED'
    );
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
    for (const [columnName, dateRule] of Object.entries(
      mappingManifest.dateColumns,
    )) {
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
