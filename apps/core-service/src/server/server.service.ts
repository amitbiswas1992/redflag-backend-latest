import {
  allergies,
  complianceFlags,
  conditions,
  db,
  diagnosticReports,
  encounters,
  ingestionJobs,
  ingestionStats,
  medications,
  observations,
  patients,
  practitioners,
  procedures,
  riskRules,
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
    @Inject('REQUEST') private request: any,
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

  private parsePatientName(nameValue: unknown): {
    firstName?: string;
    lastName?: string;
  } {
    if (!Array.isArray(nameValue) || nameValue.length === 0) {
      return {};
    }

    const first = nameValue[0] as Record<string, unknown>;
    const given = Array.isArray(first?.given) ? first.given : [];
    const firstName =
      typeof given[0] === 'string' && given[0].trim().length > 0
        ? given[0].trim()
        : undefined;
    const lastName =
      typeof first?.family === 'string' && first.family.trim().length > 0
        ? first.family.trim()
        : undefined;

    return { firstName, lastName };
  }

  private resolveCodeableText(value: unknown): string | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const node = value as Record<string, unknown>;
    if (typeof node.text === 'string' && node.text.trim().length > 0) {
      return node.text.trim();
    }

    const coding = Array.isArray(node.coding) ? node.coding : [];
    for (const entry of coding) {
      if (!entry || typeof entry !== 'object') continue;
      const candidate = entry as Record<string, unknown>;
      if (
        typeof candidate.display === 'string' &&
        candidate.display.trim().length > 0
      ) {
        return candidate.display.trim();
      }
    }

    return undefined;
  }

  private resolveCodeableCode(value: unknown): string | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const node = value as Record<string, unknown>;
    const coding = Array.isArray(node.coding) ? node.coding : [];
    for (const entry of coding) {
      if (!entry || typeof entry !== 'object') continue;
      const candidate = entry as Record<string, unknown>;
      if (typeof candidate.code === 'string' && candidate.code.trim().length > 0) {
        return candidate.code.trim();
      }
    }

    return undefined;
  }

  private normalizeGender(value?: string | null): string {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'male' || normalized === 'm') {
      return 'M';
    }
    if (normalized === 'female' || normalized === 'f') {
      return 'F';
    }
    return value ?? 'Not Available';
  }

  private getPatientAgeLabel(birthDate?: Date | null): string {
    if (!birthDate) {
      return 'Not Available';
    }

    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const monthDelta = now.getMonth() - birthDate.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birthDate.getDate())) {
      age -= 1;
    }

    if (!Number.isFinite(age) || age < 0) {
      return 'Not Available';
    }

    return `${age} years`;
  }

  private async getPatientDetailsPayload(
    patientRow: typeof patients.$inferSelect,
  ) {
    const patientId = patientRow.id;

    const [
      patientEncounters,
      patientObservations,
      patientProcedures,
      patientConditions,
      patientMedications,
      patientDiagnosticReports,
      patientIssues,
    ] = await Promise.all([
      this.findEncountersByPatientId(patientId),
      this.findObservationsByPatientId(patientId),
      this.findProceduresByPatientId(patientId),
      this.findConditionsByPatientId(patientId),
      this.findMedicationsByPatientId(patientId),
      this.findDiagnosticReportsByPatientId(patientId),
      db
        .select({
          id: complianceFlags.id,
          entityId: complianceFlags.entityId,
          entityType: complianceFlags.entityType,
          ruleId: complianceFlags.ruleId,
          flagType: complianceFlags.flagType,
          severity: complianceFlags.severity,
          description: complianceFlags.description,
          violationContext: complianceFlags.violationContext,
          resolvedAt: complianceFlags.resolvedAt,
          createdAt: complianceFlags.createdAt,
          ruleName: riskRules.ruleName,
          ruleCode: riskRules.ruleCode,
        })
        .from(complianceFlags)
        .leftJoin(
          riskRules,
          and(
            eq(complianceFlags.ruleId, riskRules.id),
            eq(riskRules.organizationId, this.orgId),
          ),
        )
        .where(
          and(
            eq(complianceFlags.organizationId, this.orgId),
            eq(complianceFlags.entityType, 'ENCOUNTER'),
          ),
        )
        .orderBy(desc(complianceFlags.createdAt)),
    ]);

    const observations = patientObservations.map((observation) => {
      const valueQuantity =
        observation.valueQuantity && typeof observation.valueQuantity === 'object'
          ? (observation.valueQuantity as Record<string, unknown>)
          : null;

      const rawQuantityValue = valueQuantity?.value;
      const quantityValue =
        typeof rawQuantityValue === 'number' || typeof rawQuantityValue === 'string'
          ? String(rawQuantityValue)
          : '';

      const unit =
        valueQuantity && typeof valueQuantity.unit === 'string'
          ? valueQuantity.unit
          : undefined;

      const codedValue = this.resolveCodeableText(observation.valueCodeableConcept);
      const observationValue =
        observation.valueString ?? quantityValue ?? codedValue ?? 'N/A';

      const label =
        this.resolveCodeableText(observation.code) ??
        this.resolveCodeableCode(observation.code) ??
        'Observation';

      return {
        ...observation,
        epicId: observation.sourceId,
        observation: label,
        testName: label,
        value: observationValue,
        quantity: unit ?? 'N/A',
        unit,
        date: (observation.effectiveDateTime ?? observation.createdAt)?.toISOString(),
        status: observation.status ?? 'Unknown',
      };
    });

    const procedures = patientProcedures.map((procedure) => {
      const procedureLabel =
        this.resolveCodeableText(procedure.code) ??
        this.resolveCodeableCode(procedure.code) ??
        'Procedure';

      return {
        ...procedure,
        epicId: procedure.sourceId,
        procedure: procedureLabel,
        display: procedureLabel,
        code: this.resolveCodeableCode(procedure.code) ?? 'N/A',
        date: (procedure.performedDateTime ?? procedure.createdAt)?.toISOString(),
        status: procedure.status ?? 'Unknown',
      };
    });

    const conditionsList = patientConditions.map((condition) => {
      const diagnosis =
        this.resolveCodeableText(condition.code) ??
        this.resolveCodeableCode(condition.code) ??
        'Condition';

      return {
        ...condition,
        epicId: condition.sourceId,
        diagnosis,
        display: diagnosis,
        code: this.resolveCodeableCode(condition.code) ?? 'N/A',
        onsetDate: (
          condition.onsetDateTime ??
          condition.recordedDate ??
          condition.createdAt
        )?.toISOString(),
        status:
          this.resolveCodeableText(condition.clinicalStatus) ??
          this.resolveCodeableCode(condition.clinicalStatus) ??
          'Unknown',
      };
    });

    const medicationsList = patientMedications.map((medication) => {
      const medicationLabel =
        this.resolveCodeableText(medication.medicationCodeableConcept) ??
        this.resolveCodeableCode(medication.medicationCodeableConcept) ??
        'Medication';

      const dosageInstruction = Array.isArray(medication.dosageInstruction)
        ? (medication.dosageInstruction[0] as Record<string, unknown> | undefined)
        : undefined;

      const dosageText =
        dosageInstruction && typeof dosageInstruction.text === 'string'
          ? dosageInstruction.text
          : 'N/A';

      return {
        ...medication,
        epicId: medication.sourceId,
        medication: medicationLabel,
        display: medicationLabel,
        dosage: dosageText,
        startDate: medication.createdAt?.toISOString(),
        status: medication.status ?? 'Unknown',
      };
    });

    const encountersList = patientEncounters.map((encounter) => {
      const periodValue =
        encounter.period && typeof encounter.period === 'object'
          ? (encounter.period as Record<string, unknown>)
          : null;

      const startDate =
        typeof periodValue?.start === 'string'
          ? periodValue.start
          : encounter.createdAt?.toISOString();

      const classDisplay =
        this.resolveCodeableText(encounter.class) ??
        this.resolveCodeableCode(encounter.class) ??
        'N/A';

      const typeDisplay =
        this.resolveCodeableText(encounter.type) ??
        this.resolveCodeableCode(encounter.type) ??
        'N/A';

      return {
        ...encounter,
        epicId: encounter.sourceId,
        startDate,
        visitType: typeDisplay,
        type: typeDisplay,
        department: classDisplay,
        provider: encounter.serviceProvider ?? 'Dr. *** (De-identified)',
      };
    });

    const issues = patientIssues.map((issue) => ({
      id: issue.id,
      entityId: issue.entityId,
      entityType: issue.entityType,
      ruleId: issue.ruleId,
      flagType: issue.flagType,
      severity: issue.severity,
      description: issue.description,
      violationContext: issue.violationContext,
      resolvedAt: issue.resolvedAt,
      createdAt: issue.createdAt,
      rule: {
        ruleName: issue.ruleName ?? 'Unknown Rule',
        ruleCode: issue.ruleCode ?? null,
      },
    }));

    const { firstName, lastName } = this.parsePatientName(patientRow.name);
    const normalizedGender =
      typeof patientRow.gender === 'string' ? patientRow.gender : null;
    const patientBirthDate =
      patientRow.birthDate instanceof Date ? patientRow.birthDate : null;

    return {
      ...patientRow,
      patientId: patientRow.sourceId,
      epicId: patientRow.sourceId,
      firstName,
      lastName,
      gender: this.normalizeGender(normalizedGender),
      age: this.getPatientAgeLabel(patientBirthDate),
      status: 'Active',
      encounterCount: encountersList.length,
      lastEncounter:
        encountersList[0]?.startDate ?? patientRow.updatedAt?.toISOString() ?? null,
      issueCount: issues.length,
      complianceStatus: issues.length > 0 ? 'At Risk' : 'Compliant',
      encounters: encountersList,
      observations,
      procedures,
      conditions: conditionsList,
      medications: medicationsList,
      diagnosticReports: patientDiagnosticReports,
      issues,
    };
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
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfThirtyDayWindow = new Date(startOfToday);
    startOfThirtyDayWindow.setDate(startOfThirtyDayWindow.getDate() - 29);

    const statsRows = await db
      .select({
        date: ingestionStats.date,
        source: ingestionStats.source,
        patients: ingestionStats.patients,
        observations: ingestionStats.observations,
        conditions: ingestionStats.conditions,
        allergies: ingestionStats.allergies,
        medications: ingestionStats.medications,
        procedures: ingestionStats.procedures,
        encounters: ingestionStats.encounters,
        diagnosticReports: ingestionStats.diagnosticReports,
      })
      .from(ingestionStats)
      .where(eq(ingestionStats.organizationId, this.orgId));

    const aggregateStats = (
      rows: Array<{
        patients: number;
        observations: number;
        conditions: number;
        allergies: number;
        medications: number;
        procedures: number;
        encounters: number;
        diagnosticReports: number;
      }>,
    ) => {
      const aggregated = rows.reduce(
        (acc, row) => {
          acc.patients += Number(row.patients ?? 0);
          acc.observations += Number(row.observations ?? 0);
          acc.conditions += Number(row.conditions ?? 0);
          acc.allergies += Number(row.allergies ?? 0);
          acc.medications += Number(row.medications ?? 0);
          acc.procedures += Number(row.procedures ?? 0);
          acc.encounters += Number(row.encounters ?? 0);
          acc.diagnosticReports += Number(row.diagnosticReports ?? 0);
          return acc;
        },
        {
          patients: 0,
          observations: 0,
          conditions: 0,
          allergies: 0,
          medications: 0,
          procedures: 0,
          encounters: 0,
          diagnosticReports: 0,
        },
      );

      return {
        ...aggregated,
        totalRecords:
          aggregated.patients +
          aggregated.observations +
          aggregated.conditions +
          aggregated.allergies +
          aggregated.medications +
          aggregated.procedures +
          aggregated.encounters +
          aggregated.diagnosticReports,
      };
    };

    const overall = aggregateStats(statsRows);
    const today = aggregateStats(
      statsRows.filter((row) => row.date && row.date >= startOfToday),
    );

    const jobRows = await db
      .select({
        id: ingestionJobs.id,
        status: ingestionJobs.status,
        sourceType: ingestionJobs.sourceType,
        totalRows: ingestionJobs.totalRows,
        processedRows: ingestionJobs.processedRows,
        successRows: ingestionJobs.successRows,
        failedRows: ingestionJobs.failedRows,
        startedAt: ingestionJobs.startedAt,
        completedAt: ingestionJobs.completedAt,
        createdAt: ingestionJobs.createdAt,
        updatedAt: ingestionJobs.updatedAt,
      })
      .from(ingestionJobs)
      .where(eq(ingestionJobs.organizationId, this.orgId))
      .orderBy(desc(ingestionJobs.updatedAt));

    const pendingStatuses = new Set<string>([
      'CREATED',
      'UPLOADED',
      'DETECTING',
      'AWAITING_CONFIRMATION',
      'RUNNING',
    ]);

    const pendingRecords = jobRows.reduce((total, job) => {
      if (!pendingStatuses.has(job.status)) {
        return total;
      }

      const totalRows = Number(job.totalRows ?? 0);
      const processedRows = Number(job.processedRows ?? 0);
      return total + Math.max(totalRows - processedRows, 0);
    }, 0);

    const failedRecords = jobRows.reduce((total, job) => {
      if (job.status !== 'FAILED') {
        return total;
      }

      const failedRows = Number(job.failedRows ?? 0);
      const totalRows = Number(job.totalRows ?? 0);
      const successRows = Number(job.successRows ?? 0);
      return total + Math.max(failedRows, Math.max(totalRows - successRows, 0));
    }, 0);

    const recentJobs = jobRows.slice(0, 10).map((job) => {
      const totalRows = Number(job.totalRows ?? 0);
      const processedRows = Number(job.processedRows ?? 0);
      const successRows = Number(job.successRows ?? 0);
      const failedRows = Number(job.failedRows ?? 0);

      return {
        id: job.id,
        status: job.status,
        sourceType: job.sourceType,
        totalRows,
        processedRows,
        successRows,
        failedRows,
        pendingRows: Math.max(totalRows - processedRows, 0),
        recordCount: totalRows > 0 ? totalRows : successRows + failedRows,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };
    });

    const dailyBySourceMap = new Map<
      string,
      {
        date: string;
        source: string;
        records: number;
      }
    >();

    for (const row of statsRows) {
      if (!row.date || row.date < startOfThirtyDayWindow) {
        continue;
      }

      const day = row.date.toISOString().slice(0, 10);
      const source = row.source ?? 'UNKNOWN';
      const records =
        Number(row.patients ?? 0) +
        Number(row.observations ?? 0) +
        Number(row.conditions ?? 0) +
        Number(row.allergies ?? 0) +
        Number(row.medications ?? 0) +
        Number(row.procedures ?? 0) +
        Number(row.encounters ?? 0) +
        Number(row.diagnosticReports ?? 0);

      const key = `${day}::${source}`;
      const current = dailyBySourceMap.get(key);

      if (current) {
        current.records += records;
      } else {
        dailyBySourceMap.set(key, {
          date: day,
          source,
          records,
        });
      }
    }

    const dailyStats = Array.from(dailyBySourceMap.values()).sort((a, b) => {
      if (a.date === b.date) {
        return a.source.localeCompare(b.source);
      }
      return a.date.localeCompare(b.date);
    });

    return {
      overall,
      today,
      pendingRecords,
      failedRecords,
      recentJobs,
      dailyStats,
    };
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
    } catch (_e) {
      throw new BadRequestException(
        'Failed to create patient, maybe epicId collision.',
      );
    }
  }

  async findAllPatients(
    skip = 0,
    take = 10,
    hasIssue?: boolean,
    filters?: {
      search?: string;
      dateRange?: string;
      department?: string;
      encounterType?: string;
    },
  ) {
    const orgCondition = eq(patients.organizationId, this.orgId);

    const allPatients = await db
      .select()
      .from(patients)
      .where(orgCondition)
      .orderBy(desc(patients.createdAt));

    const patientIds = allPatients.map((patient) => patient.id);

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

    const encounterRows =
      patientIds.length > 0
        ? await db
          .select({
            patientId: encounters.patientId,
            sourceId: encounters.sourceId,
            status: encounters.status,
            class: encounters.class,
            type: encounters.type,
            location: encounters.location,
            serviceProvider: encounters.serviceProvider,
            updatedAt: encounters.updatedAt,
            createdAt: encounters.createdAt,
          })
          .from(encounters)
          .where(
            and(
              eq(encounters.organizationId, this.orgId),
              inArray(encounters.patientId, patientIds),
            ),
          )
        : [];

    const issueCounts =
      patientIds.length > 0
        ? await db
          .select({
            entityId: complianceFlags.entityId,
            issueCount: count(),
          })
          .from(complianceFlags)
          .where(
            and(
              eq(complianceFlags.organizationId, this.orgId),
              inArray(complianceFlags.entityId, patientIds),
            ),
          )
          .groupBy(complianceFlags.entityId)
        : [];

    const encounterCountMap = new Map(
      encounterCounts.map((row) => [row.patientId, Number(row.encounterCount)]),
    );

    const issueCountMap = new Map(
      issueCounts.map((row) => [row.entityId, Number(row.issueCount)]),
    );

    const encountersByPatient = new Map<
      string,
      Array<{
        sourceId: string;
        status: string | null;
        class: unknown;
        type: unknown;
        location: unknown;
        serviceProvider: string | null;
        updatedAt: Date;
        createdAt: Date;
      }>
    >();

    for (const row of encounterRows) {
      const existing = encountersByPatient.get(row.patientId) ?? [];
      existing.push({
        sourceId: row.sourceId,
        status: row.status,
        class: row.class,
        type: row.type,
        location: row.location,
        serviceProvider: row.serviceProvider,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
      });
      encountersByPatient.set(row.patientId, existing);
    }

    const normalizeToken = (value?: string | null) =>
      (value ?? '').trim().toLowerCase();

    const parseName = (nameValue: unknown): { firstName?: string; lastName?: string } => {
      if (!Array.isArray(nameValue) || nameValue.length === 0) {
        return {};
      }

      const first = nameValue[0] as Record<string, unknown>;
      const given = Array.isArray(first?.given) ? first.given : [];
      const firstName =
        typeof given[0] === 'string' && given[0].trim().length > 0
          ? given[0].trim()
          : undefined;
      const lastName =
        typeof first?.family === 'string' && first.family.trim().length > 0
          ? first.family.trim()
          : undefined;

      return { firstName, lastName };
    };

    const rangeStart = (() => {
      const now = new Date();
      const dateRange = filters?.dateRange;
      if (dateRange === 'last-7-days') {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        return start;
      }
      if (dateRange === 'last-90-days') {
        const start = new Date(now);
        start.setDate(start.getDate() - 90);
        return start;
      }
      if (dateRange === 'last-30-days') {
        const start = new Date(now);
        start.setDate(start.getDate() - 30);
        return start;
      }
      return null;
    })();

    const searchToken = normalizeToken(filters?.search);
    const departmentToken = normalizeToken(filters?.department);
    const encounterTypeToken = normalizeToken(filters?.encounterType);

    const normalizedPatients = allPatients
      .map((patient) => {
        const { firstName, lastName } = parseName(patient.name);
        const patientEncounterRows = encountersByPatient.get(patient.id) ?? [];
        const issueCount = issueCountMap.get(patient.id) ?? 0;

        const encounterSearchBlob = patientEncounterRows
          .map((encounter) =>
            [
              encounter.sourceId,
              encounter.status,
              encounter.serviceProvider,
              JSON.stringify(encounter.class ?? ''),
              JSON.stringify(encounter.type ?? ''),
              JSON.stringify(encounter.location ?? ''),
            ]
              .join(' ')
              .toLowerCase(),
          )
          .join(' ');

        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
        const patientSearchBlob = [
          fullName,
          firstName ?? '',
          lastName ?? '',
          patient.sourceId,
        ]
          .join(' ')
          .toLowerCase();

        const matchesSearch =
          searchToken.length === 0 || patientSearchBlob.includes(searchToken);

        const matchesDateRange =
          !rangeStart || (patient.updatedAt && patient.updatedAt >= rangeStart);

        const matchesDepartment =
          !departmentToken ||
          departmentToken === 'all-departments' ||
          encounterSearchBlob.includes(departmentToken.replace('-', ' '));

        const matchesEncounterType =
          !encounterTypeToken ||
          encounterTypeToken === 'all-types' ||
          encounterSearchBlob.includes(encounterTypeToken.replace('-', ' '));

        const matchesIssueFilter =
          hasIssue === undefined ? true : hasIssue ? issueCount > 0 : issueCount === 0;

        return {
          ...patient,
          firstName,
          lastName,
          patientId: patient.sourceId,
          epicId: patient.sourceId,
          encounterCount: encounterCountMap.get(patient.id) ?? 0,
          issueCount,
          complianceStatus: issueCount > 0 ? ('At Risk' as const) : ('Compliant' as const),
          matchesSearch,
          matchesDateRange,
          matchesDepartment,
          matchesEncounterType,
          matchesIssueFilter,
        };
      })
      .filter(
        (patient) =>
          patient.matchesSearch &&
          patient.matchesDateRange &&
          patient.matchesDepartment &&
          patient.matchesEncounterType &&
          patient.matchesIssueFilter,
      );

    const total = normalizedPatients.length;
    const paginatedPatients = normalizedPatients.slice(skip, skip + take);

    const totalEncounters = paginatedPatients.reduce(
      (sum, patient) => sum + patient.encounterCount,
      0,
    );

    const averageEncountersPerPatient =
      paginatedPatients.length > 0
        ? Number((totalEncounters / paginatedPatients.length).toFixed(2))
        : 0;

    const patientsWithIssues = normalizedPatients.filter(
      (patient) => patient.issueCount > 0,
    ).length;

    return {
      patients: paginatedPatients,
      total,
      skip,
      take,
      patientsWithIssues,
      averageEncountersPerPatient,
    };
  }

  async findPatientById(id: string) {
    const res = await db
      .select()
      .from(patients)
      .where(and(eq(patients.id, id), eq(patients.organizationId, this.orgId)));
    if (!res.length) throw new NotFoundException('Patient not found');
    return this.getPatientDetailsPayload(res[0]);
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
    return this.getPatientDetailsPayload(res[0]);
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
      })
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

  async syncPatientFromEpic(_patientId: string) {
    // Temporary stub since full ingestion logic involves EpicFHIR parsing.
    return { success: true };
  }
}
