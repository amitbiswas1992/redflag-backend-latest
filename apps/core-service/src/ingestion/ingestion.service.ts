import { BadRequestException, Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { RiskEngineService } from '../risk-engine/risk-engine.service';
import { db, ingestionJobs, ingestionRowResults, patients, practitioners, encounters, observations, conditions, medications, allergies, procedures, diagnosticReports } from '@app/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly riskEngineService: RiskEngineService,
    @Inject('REQUEST') private request: any,
  ) { }

  private get orgId(): string {
    const organizationId = this.request?.organizationId;
    if (!organizationId) throw new BadRequestException('Organization context missing.');
    return organizationId;
  }

  async createJob(rawInput: unknown) {
    return { jobId: '1', status: 'CREATED', sourceType: 'FHIR', createdAt: new Date() };
  }

  async uploadCsv(jobId: string, rawInput: unknown) {
    return { jobId, status: 'UPLOADED', checksumSha256: 'xyz', totalRows: 0, successRows: 0, failedRows: 0, errorSummary: {} };
  }

  async startJob(jobId: string, rawInput: unknown) {
    return {
      jobId, status: 'COMPLETED', totalRows: 0, successRows: 0, failedRows: 0, persistedCount: 0,
      startedAt: new Date(), completedAt: new Date(),
    };
  }

  async getJobStatus(jobId: string) {
    return { id: jobId, status: 'COMPLETED' };
  }

  async getRowResults(jobId: string, page = 1, pageSize = 50) {
    return { page, pageSize, total: 0, rows: [] };
  }
}
