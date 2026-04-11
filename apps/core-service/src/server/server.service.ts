import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { db, patients, encounters, observations, conditions, allergies, medications, procedures, diagnosticReports, ingestionStats, riskEvaluations, riskRules, practitioners } from '@app/db';
import { eq, count, sum, SQL, desc, inArray } from 'drizzle-orm';
import { ClinicalService } from '../clinical/clinical.service';
import { RiskEngineService } from '../risk-engine/risk-engine.service';
import { CreatePatientDto, UpdatePatientDto, CreatePractitionerDto } from './dto/server.dto';

@Injectable()
export class ServerService {
  private readonly logger = new Logger(ServerService.name);

  constructor(
    private clinicalService: ClinicalService,
    private riskEngineService: RiskEngineService,
    @Inject('REQUEST') private request: any, // Inject request to extract OrganizationId from Headers via AuthGuard
  ) { }

  private get orgId(): string {
    const organizationId = this.request.organizationId;
    if (!organizationId) {
      throw new BadRequestException('Organization context missing. Multi-tenancy guard failed.');
    }
    return organizationId;
  }

  async getDashboardMetrics() {
    const orgCond = eq(patients.organizationId, this.orgId);
    const [totalPatients, totalEncounters, totalObservations, totalProcedures] = await Promise.all([
      db.select({ count: count() }).from(patients).where(orgCond),
      db.select({ count: count() }).from(encounters).where(eq(encounters.organizationId, this.orgId)),
      db.select({ count: count() }).from(observations).where(eq(observations.organizationId, this.orgId)),
      db.select({ count: count() }).from(procedures).where(eq(procedures.organizationId, this.orgId)),
    ]);
    return {
      totalPatients: totalPatients[0].count,
      totalEncounters: totalEncounters[0].count,
      totalObservations: totalObservations[0].count,
      totalProcedures: totalProcedures[0].count,
    };
  }


  async getIngestionDashboardMetrics() {
    // Stub out for Drizzle since ingestionStats doesn't fully represent it right now.
    // In an actual multi-tenant env, aggregate group queries here.
    return { overall: { totalRecords: 0 }, today: { totalRecords: 0 } };
  }

  async getRiskRulesDashboardMetrics() {
    // Stub out for Risk Rules Group By.
    return {
      totalRules: 0,
      activeRules: 0,
      totalIssues: 0,
      totalScore: 0,
      averageScore: 0,
      riskLevelBreakdown: {},
      topRulesWithIssues: [],
    };
  }

  async createPatient(createPatientDto: CreatePatientDto) {
    try {
      const inserted = await db.insert(patients).values({
        ...createPatientDto,
        organizationId: this.orgId,
        sourceId: createPatientDto.epicId || '',
        name: [{ family: createPatientDto.lastName || '', given: [createPatientDto.firstName || ''] }],
        birthDate: createPatientDto.birthDate ? new Date(createPatientDto.birthDate) : null,
      }).returning();
      return inserted[0];
    } catch (e) {
      throw new BadRequestException('Failed to create patient, maybe epicId collision.');
    }
  }

  async findAllPatients(skip = 0, take = 10, hasIssue?: boolean) {
    const list = await db.select().from(patients).where(eq(patients.organizationId, this.orgId)).limit(take).offset(skip).orderBy(desc(patients.createdAt));
    return {
      patients: list,
      total: list.length, // approximation
      skip,
      take,
      patientsWithIssues: 0,
      averageEncountersPerPatient: 0
    };
  }

  async findPatientById(id: string) {
    const res = await db.select().from(patients).where(eq(patients.id, id));
    if (!res.length) throw new NotFoundException('Patient not found');
    return res[0];
  }

  async findPatientByEpicId(epicId: string) {
    const res = await db.select().from(patients).where(eq(patients.sourceId, epicId));
    if (!res.length) throw new NotFoundException('Patient not found');
    return res[0];
  }

  async updatePatient(id: string, updatePatientDto: UpdatePatientDto) {
    const up = await db.update(patients).set({
      ...updatePatientDto,
      birthDate: updatePatientDto.birthDate ? new Date(updatePatientDto.birthDate) : undefined
    }).where(eq(patients.id, id)).returning();
    return up[0];
  }

  async deletePatient(id: string) {
    await db.delete(patients).where(eq(patients.id, id));
    return { message: 'Deleted' };
  }

  async createPractitioner(dto: CreatePractitionerDto) {
    const proc = await db.insert(practitioners).values({
      organizationId: this.orgId,
      sourceId: dto.epicId || '',
      name: [{ family: dto.lastName || '', given: [dto.firstName || ''] }]
    } as any).returning();
    return proc[0];
  }

  async findAllPractitioners(skip = 0, take = 10) {
    const res = await db.select().from(practitioners).where(eq(practitioners.organizationId, this.orgId)).limit(take).offset(skip);
    return { practitioners: res, total: res.length, skip, take };
  }

  async findPractitionerById(id: string) {
    const p = await db.select().from(practitioners).where(eq(practitioners.id, id));
    return p[0];
  }

  async findPractitionerByEpicId(epicId: string) {
    const p = await db.select().from(practitioners).where(eq(practitioners.sourceId, epicId));
    return p[0];
  }

  async findObservationsByPatientId(patientId: string) {
    return db.select().from(observations).where(eq(observations.patientId, patientId)).orderBy(desc(observations.effectiveDateTime));
  }

  async findConditionsByPatientId(patientId: string) {
    return db.select().from(conditions).where(eq(conditions.patientId, patientId)).orderBy(desc(conditions.recordedDate));
  }

  async findAllergiesByPatientId(patientId: string) {
    return db.select().from(allergies).where(eq(allergies.patientId, patientId)).orderBy(desc(allergies.recordedDate));
  }

  async findMedicationsByPatientId(patientId: string) {
    return db.select().from(medications).where(eq(medications.patientId, patientId)).orderBy(desc(medications.createdAt));
  }

  async findProceduresByPatientId(patientId: string) {
    return db.select().from(procedures).where(eq(procedures.patientId, patientId));
  }

  async findEncountersByPatientId(patientId: string) {
    return db.select().from(encounters).where(eq(encounters.patientId, patientId)).orderBy(desc(encounters.createdAt));
  }

  async findDiagnosticReportsByPatientId(patientId: string) {
    return db.select().from(diagnosticReports).where(eq(diagnosticReports.patientId, patientId));
  }

  async syncPatientFromEpic(patientId: string) {
    // Temporary stub since full ingestion logic involves EpicFHIR parsing.
    return { success: true };
  }
}
