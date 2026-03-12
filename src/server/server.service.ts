import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { ClinicalService } from '../clinical/clinical.service';
import { RiskEngineService } from '../risk-engine/risk-engine.service';
import {
  CreatePatientDto,
  UpdatePatientDto,
  CreatePractitionerDto,
} from './dto/server.dto';
import {
  NormalizedPatient,
  NormalizedObservation,
  NormalizedCondition,
  NormalizedAllergy,
  NormalizedMedication,
  NormalizedProcedure,
  NormalizedEncounter,
  NormalizedDiagnosticReport,
} from '../clinical/interfaces/clinical.interface';

@Injectable()
export class ServerService {
  private readonly logger = new Logger(ServerService.name);

  constructor(
    private prisma: PrismaService,
    private clinicalService: ClinicalService,
    private riskEngineService: RiskEngineService,
  ) {}

  /**
   * Simple dashboard metrics for high-level monitoring.
   * Returns total counts across core clinical tables.
   */
  async getDashboardMetrics() {
    const [totalPatients, totalEncounters, totalObservations, totalProcedures] =
      await Promise.all([
        this.prisma.patient.count(),
        this.prisma.encounter.count(),
        this.prisma.observation.count(),
        this.prisma.procedure.count(),
      ]);

    return {
      totalPatients,
      totalEncounters,
      totalObservations,
      totalProcedures,
    };
  }

  /**
   * Dashboard metrics for ingestion activity (overall and today).
   */
  async getIngestionDashboardMetrics() {
    // Overall sums across all ingestion stats
    const overall = await this.prisma.ingestionStat.aggregate({
      _sum: {
        patients: true,
        observations: true,
        conditions: true,
        allergies: true,
        medications: true,
        procedures: true,
        encounters: true,
        diagnosticReports: true,
      },
    });

    // Today window [startOfDay, endOfDay)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const today = await this.prisma.ingestionStat.aggregate({
      where: {
        date: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
      },
      _sum: {
        patients: true,
        observations: true,
        conditions: true,
        allergies: true,
        medications: true,
        procedures: true,
        encounters: true,
        diagnosticReports: true,
      },
    });

    const sum = (v: number | null | undefined) => v ?? 0;

    const overallTotals = {
      patients: sum(overall._sum.patients),
      observations: sum(overall._sum.observations),
      conditions: sum(overall._sum.conditions),
      allergies: sum(overall._sum.allergies),
      medications: sum(overall._sum.medications),
      procedures: sum(overall._sum.procedures),
      encounters: sum(overall._sum.encounters),
      diagnosticReports: sum(overall._sum.diagnosticReports),
    };

    const todayTotals = {
      patients: sum(today._sum.patients),
      observations: sum(today._sum.observations),
      conditions: sum(today._sum.conditions),
      allergies: sum(today._sum.allergies),
      medications: sum(today._sum.medications),
      procedures: sum(today._sum.procedures),
      encounters: sum(today._sum.encounters),
      diagnosticReports: sum(today._sum.diagnosticReports),
    };

    return {
      overall: {
        ...overallTotals,
        totalRecords: Object.values(overallTotals).reduce(
          (acc, cur) => acc + cur,
          0,
        ),
      },
      today: {
        ...todayTotals,
        totalRecords: Object.values(todayTotals).reduce(
          (acc, cur) => acc + cur,
          0,
        ),
      },
    };
  }

  // Patient CRUD
  async createPatient(createPatientDto: CreatePatientDto) {
    try {
      const patient = await this.prisma.patient.create({
        data: {
          ...createPatientDto,
          birthDate: createPatientDto.birthDate
            ? new Date(createPatientDto.birthDate)
            : null,
          identifiers: createPatientDto.identifiers
            ? (createPatientDto.identifiers as any)
            : undefined,
        },
      });
      return patient;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          `Patient with epicId ${createPatientDto.epicId} already exists`,
        );
      }
      this.logger.error(`Error creating patient: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAllPatients(skip = 0, take = 10, hasIssue?: boolean) {
    // Optional filter by issue (matched risk evaluation)
    const where: any = {};

    if (hasIssue === true) {
      where.riskEvaluations = {
        some: {
          matched: true,
        },
      };
    } else if (hasIssue === false) {
      where.riskEvaluations = {
        none: {
          matched: true,
        },
      };
    }

    const [
      patients,
      total,
      globalPatientsWithIssues,
      globalEncounterCount,
      globalPatientCount,
    ] = await Promise.all([
      this.prisma.patient.findMany({
        skip,
        take,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          // Include all encounters so callers can see full encounter history per patient
          encounters: {
            orderBy: { startDate: 'desc' },
          },
          _count: {
            select: {
              encounters: true,
              riskEvaluations: true,
            },
          },
        },
      }),
      // Total patients matching current filter (for pagination)
      this.prisma.patient.count({ where }),
      // Global: total patients that have at least one matched issue (across all patients)
      this.prisma.patient.count({
        where: {
          riskEvaluations: {
            some: {
              matched: true,
            },
          },
        },
      }),
      // Global: total number of encounters across all patients
      this.prisma.encounter.count(),
      // Global: total number of patients (used for average encounters per patient)
      this.prisma.patient.count(),
    ]);

    // Get patient IDs to count matched risk evaluations (issues)
    const patientIds = patients.map((p) => p.id);
    
    // Count matched risk evaluations (issues) for all patients in a single query
    const issueCountsMap = new Map<string, number>();
    
    if (patientIds.length > 0) {
      const issueCounts = await this.prisma.riskEvaluation.groupBy({
        by: ['patientId'],
        where: {
          patientId: { in: patientIds },
          matched: true, // Only count matched rule triggers
        },
        _count: {
          id: true,
        },
      });

      // Create a map for quick lookup
      issueCounts.forEach((item) => {
        issueCountsMap.set(item.patientId, item._count.id);
      });
    }

    // Map patients to include encounterCount and issueCount
    const patientsWithCounts = patients.map((patient) => {
      const { _count, ...patientData } = patient;
      return {
        ...patientData,
        encounterCount: _count.encounters,
        issueCount: issueCountsMap.get(patient.id) || 0, // Count of matched risk rule triggers
      };
    });

    // Aggregate meta statistics based on ALL patients in the system,
    // not just the current paginated page.
    const patientsWithIssues = globalPatientsWithIssues;
    const averageEncountersPerPatient =
      globalPatientCount > 0
        ? globalEncounterCount / globalPatientCount
        : 0;

    return {
      patients: patientsWithCounts,
      total,
      skip,
      take,
      patientsWithIssues,
      averageEncountersPerPatient,
    };
  }

  async findPatientById(id: string) {
    const [patient, issues] = await Promise.all([
      this.prisma.patient.findUnique({
        where: { id },
        include: {
          observations: true,
          conditions: true,
          allergies: true,
          medications: true,
          procedures: true,
          encounters: true,
          diagnosticReports: true,
        },
      }),
      // Get matched risk evaluations (issues) for this patient with rule details
      this.prisma.riskEvaluation.findMany({
        where: {
          patientId: id,
          matched: true,
        },
        include: {
          rule: {
            include: {
              conditions: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
        orderBy: {
          evaluatedAt: 'desc',
        },
      }),
    ]);

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    // Include issueCount and issues array (matched risk rule triggers) in the response
    return {
      ...patient,
      issueCount: issues.length,
      issues,
    };
  }

  async findPatientByEpicId(epicId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { epicId },
      include: {
        observations: true,
        conditions: true,
        allergies: true,
        medications: true,
        procedures: true,
        encounters: true,
        diagnosticReports: true,
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with Epic ID ${epicId} not found`);
    }

    return patient;
  }

  async updatePatient(id: string, updatePatientDto: UpdatePatientDto) {
    try {
      const patient = await this.prisma.patient.update({
        where: { id },
        data: {
          ...updatePatientDto,
          birthDate: updatePatientDto.birthDate
            ? new Date(updatePatientDto.birthDate)
            : undefined,
        },
      });
      return patient;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Patient with ID ${id} not found`);
      }
      this.logger.error(`Error updating patient: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deletePatient(id: string) {
    try {
      await this.prisma.patient.delete({ where: { id } });
      return { message: `Patient with ID ${id} deleted successfully` };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Patient with ID ${id} not found`);
      }
      this.logger.error(`Error deleting patient: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Practitioner CRUD
  async createPractitioner(createPractitionerDto: CreatePractitionerDto) {
    try {
      const practitioner = await this.prisma.practitioner.create({
        data: {
          ...createPractitionerDto,
          birthDate: createPractitionerDto.birthDate
            ? new Date(createPractitionerDto.birthDate)
            : null,
          prefix: createPractitionerDto.prefix || [],
          suffix: createPractitionerDto.suffix || [],
          languages: createPractitionerDto.languages || [],
          identifiers: createPractitionerDto.identifiers
            ? (createPractitionerDto.identifiers as any)
            : undefined,
          telecom: createPractitionerDto.telecom
            ? (createPractitionerDto.telecom as any)
            : undefined,
          address: createPractitionerDto.address
            ? (createPractitionerDto.address as any)
            : undefined,
          qualifications: createPractitionerDto.qualifications
            ? (createPractitionerDto.qualifications as any)
            : undefined,
        },
      });
      return practitioner;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          `Practitioner with epicId ${createPractitionerDto.epicId} already exists`,
        );
      }
      this.logger.error(
        `Error creating practitioner: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findAllPractitioners(skip = 0, take = 10) {
    const [practitioners, total] = await Promise.all([
      this.prisma.practitioner.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.practitioner.count(),
    ]);

    return { practitioners, total, skip, take };
  }

  async findPractitionerById(id: string) {
    const practitioner = await this.prisma.practitioner.findUnique({
      where: { id },
    });

    if (!practitioner) {
      throw new NotFoundException(`Practitioner with ID ${id} not found`);
    }

    return practitioner;
  }

  async findPractitionerByEpicId(epicId: string) {
    const practitioner = await this.prisma.practitioner.findUnique({
      where: { epicId },
    });

    if (!practitioner) {
      throw new NotFoundException(
        `Practitioner with Epic ID ${epicId} not found`,
      );
    }

    return practitioner;
  }

  // Observation operations (read-only, data comes from Epic sync)
  async findObservationsByPatientId(patientId: string) {
    return this.prisma.observation.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });
  }

  // Condition operations (read-only, data comes from Epic sync)
  async findConditionsByPatientId(patientId: string) {
    return this.prisma.condition.findMany({
      where: { patientId },
      orderBy: { recordedDate: 'desc' },
    });
  }

  // Allergy operations (read-only, data comes from Epic sync)
  async findAllergiesByPatientId(patientId: string) {
    return this.prisma.allergy.findMany({
      where: { patientId },
      orderBy: { recordedDate: 'desc' },
    });
  }

  // Medication operations (read-only, data comes from Epic sync)
  async findMedicationsByPatientId(patientId: string) {
    return this.prisma.medication.findMany({
      where: { patientId },
      orderBy: { startDate: 'desc' },
    });
  }

  // Procedure operations (read-only, data comes from Epic sync)
  async findProceduresByPatientId(patientId: string) {
    return this.prisma.procedure.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });
  }

  // Encounter operations (read-only, data comes from Epic sync)
  async findEncountersByPatientId(patientId: string) {
    return this.prisma.encounter.findMany({
      where: { patientId },
      orderBy: { startDate: 'desc' },
    });
  }

  // DiagnosticReport operations (read-only, data comes from Epic sync)
  async findDiagnosticReportsByPatientId(patientId: string) {
    return this.prisma.diagnosticReport.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });
  }

  // Sync operations
  /**
   * Sync patient data from Epic to database
   * Fetches all patient data from Epic and upserts into database
   * @param patientId - Epic FHIR Patient ID
   */
  async syncPatientFromEpic(patientId: string) {
    this.logger.log(`Starting sync for patient: ${patientId}`);

    try {
      // Fetch all patient data from Epic
      const diagnosisData = await this.clinicalService.getDiagnosisData(
        patientId,
      );

      // Upsert patient
      const patient = await this.upsertPatient(diagnosisData.patient);

      // Upsert all related data in parallel
      await Promise.all([
        this.upsertObservations(patient.id, diagnosisData.observations),
        this.upsertConditions(patient.id, diagnosisData.conditions),
        this.upsertAllergies(patient.id, diagnosisData.allergies),
        this.upsertMedications(patient.id, diagnosisData.medications),
        this.upsertProcedures(patient.id, diagnosisData.procedures),
        this.upsertEncounters(patient.id, diagnosisData.encounters),
        this.upsertDiagnosticReports(
          patient.id,
          diagnosisData.diagnosticReports,
        ),
      ]);

      this.logger.log(
        `Successfully synced patient ${patientId} with all related data`,
      );

      // Trigger risk rule evaluation after sync
      let riskEvaluation: any | null = null;
      try {
        this.logger.log(`Triggering risk rule evaluation for patient: ${patient.id}`);
        riskEvaluation = await this.riskEngineService.evaluatePatientRules(
          patient.id,
        );
        this.logger.log(
          `Risk evaluation complete: ${riskEvaluation.matchedRulesCount} rules matched, total score: ${riskEvaluation.totalScore}`,
        );
      } catch (error) {
        this.logger.error(
          `Error evaluating risk rules for patient ${patient.id}: ${error.message}`,
          error.stack,
        );
        // Don't fail the sync if risk evaluation fails
      }

      return {
        success: true,
        patientId: patient.id,
        epicId: patient.epicId,
        synced: {
          observations: diagnosisData.observations.length,
          conditions: diagnosisData.conditions.length,
          allergies: diagnosisData.allergies.length,
          medications: diagnosisData.medications.length,
          procedures: diagnosisData.procedures.length,
          encounters: diagnosisData.encounters.length,
          diagnosticReports: diagnosisData.diagnosticReports.length,
        },
        forbiddenScopes: diagnosisData.forbiddenScopes,
        riskEvaluation: riskEvaluation
          ? {
              totalScore: riskEvaluation.totalScore,
              matchedRulesCount: riskEvaluation.matchedRulesCount,
              highestRiskLevel: riskEvaluation.highestRiskLevel,
            }
          : null,
      };
    } catch (error) {
      this.logger.error(
        `Error syncing patient ${patientId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Helper methods for upserting data
  private async upsertPatient(patient: NormalizedPatient) {
    const birthDate = patient.birthDate
      ? new Date(patient.birthDate)
      : undefined;

    return this.prisma.patient.upsert({
      where: { epicId: patient.id },
      update: {
        name: patient.name,
        firstName: patient.firstName,
        lastName: patient.lastName,
        birthDate,
        gender: patient.gender,
          identifiers: patient.identifiers
            ? (patient.identifiers as any)
            : undefined,
      },
      create: {
        epicId: patient.id,
        name: patient.name,
        firstName: patient.firstName,
        lastName: patient.lastName,
        birthDate,
        gender: patient.gender,
          identifiers: patient.identifiers
            ? (patient.identifiers as any)
            : undefined,
      },
    });
  }

  private async upsertObservations(
    patientId: string,
    observations: NormalizedObservation[],
  ) {
    const upsertPromises = observations.map((obs) => {
      const date = obs.date ? new Date(obs.date) : new Date();
      // Always insert a new observation row, even if epicId is duplicated
      return this.prisma.observation.create({
        data: {
          epicId: obs.id,
          patientId,
          testName: obs.display,
          value: obs.value?.toString() || '',
          date,
          status: obs.status,
          code: obs.code,
          display: obs.display,
          category: obs.category,
          unit: obs.unit,
        },
      });
    });

    return Promise.all(upsertPromises);
  }

  private async upsertConditions(
    patientId: string,
    conditions: NormalizedCondition[],
  ) {
    const upsertPromises = conditions.map((cond) => {
      // Always insert a new condition row, even if epicId is duplicated
      return this.prisma.condition.create({
        data: {
          epicId: cond.id,
          patientId,
          diagnosis: cond.display,
          status: cond.status || 'unknown',
          onsetDate: cond.onsetDate ? new Date(cond.onsetDate) : undefined,
          recordedDate: cond.recordedDate
            ? new Date(cond.recordedDate)
            : undefined,
          code: cond.code,
          display: cond.display,
          category: cond.category,
        },
      });
    });

    return Promise.all(upsertPromises);
  }

  private async upsertAllergies(
    patientId: string,
    allergies: NormalizedAllergy[],
  ) {
    const upsertPromises = allergies.map((allergy) => {
      // Always insert a new allergy row, even if epicId is duplicated
      return this.prisma.allergy.create({
        data: {
          epicId: allergy.id,
          patientId,
          allergen: allergy.display,
          type: allergy.type || 'unknown',
          severity: allergy.criticality,
          status: allergy.status || 'unknown',
          recordedDate: allergy.recordedDate
            ? new Date(allergy.recordedDate)
            : undefined,
          code: allergy.code,
          display: allergy.display,
          category: allergy.category || [],
          criticality: allergy.criticality,
        },
      });
    });

    return Promise.all(upsertPromises);
  }

  private async upsertMedications(
    patientId: string,
    medications: NormalizedMedication[],
  ) {
    const upsertPromises = medications.map((med) => {
      // Always insert a new medication row, even if epicId is duplicated
      return this.prisma.medication.create({
        data: {
          epicId: med.id,
          patientId,
          medication: med.display,
          status: med.status,
          dosage: med.dosage,
          route: med.route,
          startDate: med.startDate ? new Date(med.startDate) : undefined,
          endDate: med.endDate ? new Date(med.endDate) : undefined,
          dateAsserted: med.dateAsserted
            ? new Date(med.dateAsserted)
            : undefined,
          code: med.code,
          display: med.display,
        },
      });
    });

    return Promise.all(upsertPromises);
  }

  private async upsertProcedures(
    patientId: string,
    procedures: NormalizedProcedure[],
  ) {
    const upsertPromises = procedures.map((proc) => {
      // Always insert a new procedure row, even if epicId is duplicated
      return this.prisma.procedure.create({
        data: {
          epicId: proc.id,
          patientId,
          procedure: proc.display,
          status: proc.status,
          date: proc.performedDate
            ? new Date(proc.performedDate)
            : undefined,
          outcome: proc.outcome,
          code: proc.code,
          display: proc.display,
          category: proc.category,
          performedDate: proc.performedDate
            ? new Date(proc.performedDate)
            : undefined,
        },
      });
    });

    return Promise.all(upsertPromises);
  }

  private async upsertEncounters(
    patientId: string,
    encounters: NormalizedEncounter[],
  ) {
    const upsertPromises = encounters.map((enc) => {
      // Always insert a new encounter row, even if epicId is duplicated
      return this.prisma.encounter.create({
        data: {
          epicId: enc.id,
          patientId,
          visitType: enc.type || enc.class || 'unknown',
          reason: enc.reason,
          startDate: enc.startDate ? new Date(enc.startDate) : undefined,
          endDate: enc.endDate ? new Date(enc.endDate) : undefined,
          status: enc.status,
          type: enc.type,
          class: enc.class,
        },
      });
    });

    return Promise.all(upsertPromises);
  }

  private async upsertDiagnosticReports(
    patientId: string,
    reports: NormalizedDiagnosticReport[],
  ) {
    const upsertPromises = reports.map((report) => {
      // Always insert a new diagnostic report row, even if epicId is duplicated
      return this.prisma.diagnosticReport.create({
        data: {
          epicId: report.id,
          patientId,
          reportName: report.display,
          status: report.status,
          date: report.effectiveDate
            ? new Date(report.effectiveDate)
            : undefined,
          conclusion: report.conclusion,
          code: report.code,
          display: report.display,
          category: report.category,
          effectiveDate: report.effectiveDate
            ? new Date(report.effectiveDate)
            : undefined,
          issuedDate: report.issuedDate
            ? new Date(report.issuedDate)
            : undefined,
        },
      });
    });

    return Promise.all(upsertPromises);
  }
}

