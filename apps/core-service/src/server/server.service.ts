import {
  allergies,
  conditions,
  db,
  diagnosticReports,
  encounters,
  medications,
  observations,
  patients,
  practitioners,
  procedures,
} from '@app/db';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { ClinicalService } from '../clinical/clinical.service';
import { RiskEngineService } from '../risk-engine/risk-engine.service';
import {
  CreatePatientDto,
  CreatePractitionerDto,
  UpdatePatientDto,
} from './dto/server.dto';

@Injectable()
export class ServerService {
  private readonly logger = new Logger(ServerService.name);

  constructor(
    private clinicalService: ClinicalService,
    private riskEngineService: RiskEngineService,
    @Inject('REQUEST') private request: any, // Inject request to extract OrganizationId from Headers via AuthGuard
  ) { }

  private get orgId(): string {
    const organizationId = this.request.organizationId ?? this.request.tenantId;
    if (!organizationId) {
      throw new BadRequestException(
        'Organization context missing. Multi-tenancy guard failed.',
      );
    }
    return organizationId;
  }

  async getDashboardMetrics() {
    const orgCond = eq(patients.organizationId, this.orgId);
    const [totalPatients, totalEncounters, totalObservations, totalProcedures] =
      await Promise.all([
        db.select({ count: count() }).from(patients).where(orgCond),
        db
          .select({ count: count() })
          .from(encounters)
          .where(eq(encounters.organizationId, this.orgId)),
        db
          .select({ count: count() })
          .from(observations)
          .where(eq(observations.organizationId, this.orgId)),
        db
          .select({ count: count() })
          .from(procedures)
          .where(eq(procedures.organizationId, this.orgId)),
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
      const inserted = await db
        .insert(patients)
        .values({
          ...createPatientDto,
          organizationId: this.orgId,
          sourceId: createPatientDto.epicId || '',
          name: [
            {
              family: createPatientDto.lastName || '',
              given: [createPatientDto.firstName || ''],
            },
          ],
          birthDate: createPatientDto.birthDate
            ? new Date(createPatientDto.birthDate)
            : null,
        })
        .returning();
      return inserted[0];
    } catch (e) {
      throw new BadRequestException(
        'Failed to create patient, maybe epicId collision.',
      );
    }
  }

  async findAllPatients(skip = 0, take = 10, hasIssue?: boolean) {
    const orgCondition = eq(patients.organizationId, this.orgId);

    const list = await db
      .select()
      .from(patients)
      .where(orgCondition)
      .limit(take)
      .offset(skip)
      .orderBy(desc(patients.createdAt));

    const [{ total }] = await db
      .select({ total: count() })
      .from(patients)
      .where(orgCondition);

    const patientIds = list.map((patient) => patient.id);

    const encounterCounts =
      patientIds.length > 0
        ? await db
          .select({
            patientId: encounters.patientId,
            encounterCount: count(),
          })
          .from(encounters)
          .where(
            and(
              eq(encounters.organizationId, this.orgId),
              inArray(encounters.patientId, patientIds),
            ),
          )
          .groupBy(encounters.patientId)
        : [];

    const encounterCountMap = new Map(
      encounterCounts.map((row) => [row.patientId, Number(row.encounterCount)]),
    );

    const normalizedPatients = list.map((patient) => ({
      ...patient,
      patientId: patient.sourceId,
      epicId: patient.sourceId,
      encounterCount: encounterCountMap.get(patient.id) ?? 0,
      issueCount: 0,
      complianceStatus: 'Compliant' as const,
    }));

    const totalEncounters = normalizedPatients.reduce(
      (sum, patient) => sum + patient.encounterCount,
      0,
    );

    const averageEncountersPerPatient =
      normalizedPatients.length > 0
        ? Number((totalEncounters / normalizedPatients.length).toFixed(2))
        : 0;

    return {
      patients: normalizedPatients,
      total: Number(total ?? 0),
      skip,
      take,
      patientsWithIssues: 0,
      averageEncountersPerPatient,
    };
  }

  async findPatientById(id: string) {
    const res = await db
      .select()
      .from(patients)
      .where(and(eq(patients.id, id), eq(patients.organizationId, this.orgId)));
    if (!res.length) throw new NotFoundException('Patient not found');
    return res[0];
  }

  async findPatientByEpicId(epicId: string) {
    const res = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.sourceId, epicId),
          eq(patients.organizationId, this.orgId),
        ),
      );
    if (!res.length) throw new NotFoundException('Patient not found');
    return res[0];
  }

  async updatePatient(id: string, updatePatientDto: UpdatePatientDto) {
    const up = await db
      .update(patients)
      .set({
        ...updatePatientDto,
        birthDate: updatePatientDto.birthDate
          ? new Date(updatePatientDto.birthDate)
          : undefined,
      })
      .where(and(eq(patients.id, id), eq(patients.organizationId, this.orgId)))
      .returning();
    if (!up.length) throw new NotFoundException('Patient not found');
    return up[0];
  }

  async deletePatient(id: string) {
    const deleted = await db
      .delete(patients)
      .where(and(eq(patients.id, id), eq(patients.organizationId, this.orgId)))
      .returning({ id: patients.id });
    if (!deleted.length) throw new NotFoundException('Patient not found');
    return { message: 'Deleted' };
  }

  async createPractitioner(dto: CreatePractitionerDto) {
    const proc = await db
      .insert(practitioners)
      .values({
        organizationId: this.orgId,
        sourceId: dto.epicId || '',
        name: [{ family: dto.lastName || '', given: [dto.firstName || ''] }],
      } as any)
      .returning();
    return proc[0];
  }

  async findAllPractitioners(skip = 0, take = 10) {
    const res = await db
      .select()
      .from(practitioners)
      .where(eq(practitioners.organizationId, this.orgId))
      .limit(take)
      .offset(skip);
    return { practitioners: res, total: res.length, skip, take };
  }

  async findPractitionerById(id: string) {
    const p = await db
      .select()
      .from(practitioners)
      .where(
        and(
          eq(practitioners.id, id),
          eq(practitioners.organizationId, this.orgId),
        ),
      );
    if (!p.length) throw new NotFoundException('Practitioner not found');
    return p[0];
  }

  async findPractitionerByEpicId(epicId: string) {
    const p = await db
      .select()
      .from(practitioners)
      .where(
        and(
          eq(practitioners.sourceId, epicId),
          eq(practitioners.organizationId, this.orgId),
        ),
      );
    if (!p.length) throw new NotFoundException('Practitioner not found');
    return p[0];
  }

  async findObservationsByPatientId(patientId: string) {
    return db
      .select()
      .from(observations)
      .where(
        and(
          eq(observations.patientId, patientId),
          eq(observations.organizationId, this.orgId),
        ),
      )
      .orderBy(desc(observations.effectiveDateTime));
  }

  async findConditionsByPatientId(patientId: string) {
    return db
      .select()
      .from(conditions)
      .where(
        and(
          eq(conditions.patientId, patientId),
          eq(conditions.organizationId, this.orgId),
        ),
      )
      .orderBy(desc(conditions.recordedDate));
  }

  async findAllergiesByPatientId(patientId: string) {
    return db
      .select()
      .from(allergies)
      .where(
        and(
          eq(allergies.patientId, patientId),
          eq(allergies.organizationId, this.orgId),
        ),
      )
      .orderBy(desc(allergies.recordedDate));
  }

  async findMedicationsByPatientId(patientId: string) {
    return db
      .select()
      .from(medications)
      .where(
        and(
          eq(medications.patientId, patientId),
          eq(medications.organizationId, this.orgId),
        ),
      )
      .orderBy(desc(medications.createdAt));
  }

  async findProceduresByPatientId(patientId: string) {
    return db
      .select()
      .from(procedures)
      .where(
        and(
          eq(procedures.patientId, patientId),
          eq(procedures.organizationId, this.orgId),
        ),
      );
  }

  async findEncountersByPatientId(patientId: string) {
    return db
      .select()
      .from(encounters)
      .where(
        and(
          eq(encounters.patientId, patientId),
          eq(encounters.organizationId, this.orgId),
        ),
      )
      .orderBy(desc(encounters.createdAt));
  }

  async findDiagnosticReportsByPatientId(patientId: string) {
    return db
      .select()
      .from(diagnosticReports)
      .where(
        and(
          eq(diagnosticReports.patientId, patientId),
          eq(diagnosticReports.organizationId, this.orgId),
        ),
      );
  }

  async syncPatientFromEpic(patientId: string) {
    // Temporary stub since full ingestion logic involves EpicFHIR parsing.
    return { success: true };
  }
}
