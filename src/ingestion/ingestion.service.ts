import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../server/prisma.service';
import { ClinicalService } from '../clinical/clinical.service';
import { RiskEngineService } from '../risk-engine/risk-engine.service';
import {
  FhirPatient,
  FhirObservation,
  FhirCondition,
  FhirAllergyIntolerance,
  FhirMedicationStatement,
  FhirProcedure,
  FhirEncounter,
  FhirDiagnosticReport,
  FhirBundle,
} from '../fhir/interfaces/fhir.interface';
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
import {
  BulkIngestDto,
  SimplePatientDto,
  SimpleObservationDto,
  SimpleConditionDto,
  SimpleAllergyDto,
  SimpleMedicationDto,
  SimpleProcedureDto,
  SimpleEncounterDto,
  SimpleDiagnosticReportDto,
} from './dto/ingestion.dto';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private prisma: PrismaService,
    private clinicalService: ClinicalService,
    private riskEngineService: RiskEngineService,
  ) {}

  /**
   * Ingest FHIR JSON data (single resource or bundle)
   * @param fhirData - FHIR resource or bundle in JSON format
   * @param patientId - Optional patient ID if ingesting a single resource
   */
  async ingestFhirJson(fhirData: any): Promise<{
    success: boolean;
    patientId?: string;
    epicId?: string;
    ingested: {
      patient?: number;
      observations?: number;
      conditions?: number;
      allergies?: number;
      medications?: number;
      procedures?: number;
      encounters?: number;
      diagnosticReports?: number;
    };
    riskEvaluation?: {
      totalScore: number;
      matchedRulesCount: number;
      highestRiskLevel: string | null;
    };
  }> {
    try {
      // Check if it's a Bundle or single resource
      if (fhirData.resourceType === 'Bundle') {
        return this.ingestFhirBundle(fhirData as FhirBundle);
      } else {
        return this.ingestFhirResource(fhirData);
      }
    } catch (error) {
      this.logger.error(
        `Error ingesting FHIR JSON data: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to ingest FHIR data: ${error.message}`,
      );
    }
  }

  /**
   * Ingest FHIR Bundle
   */
  private async ingestFhirBundle(bundle: FhirBundle) {
    if (!bundle.entry || bundle.entry.length === 0) {
      throw new BadRequestException('Bundle contains no entries');
    }

    const resources = {
      patient: [] as FhirPatient[],
      observations: [] as FhirObservation[],
      conditions: [] as FhirCondition[],
      allergies: [] as FhirAllergyIntolerance[],
      medications: [] as FhirMedicationStatement[],
      procedures: [] as FhirProcedure[],
      encounters: [] as FhirEncounter[],
      diagnosticReports: [] as FhirDiagnosticReport[],
    };

    // Extract resources by type
    for (const entry of bundle.entry) {
      if (!entry.resource) continue;

      const resourceType = entry.resource.resourceType;
      switch (resourceType) {
        case 'Patient':
          resources.patient.push(entry.resource as FhirPatient);
          break;
        case 'Observation':
          resources.observations.push(entry.resource as FhirObservation);
          break;
        case 'Condition':
          resources.conditions.push(entry.resource as FhirCondition);
          break;
        case 'AllergyIntolerance':
          resources.allergies.push(entry.resource as FhirAllergyIntolerance);
          break;
        case 'MedicationStatement':
          resources.medications.push(entry.resource as FhirMedicationStatement);
          break;
        case 'Procedure':
          resources.procedures.push(entry.resource as FhirProcedure);
          break;
        case 'Encounter':
          resources.encounters.push(entry.resource as FhirEncounter);
          break;
        case 'DiagnosticReport':
          resources.diagnosticReports.push(
            entry.resource as FhirDiagnosticReport,
          );
          break;
        default:
          this.logger.warn(
            `Unknown resource type: ${resourceType}, skipping`,
          );
      }
    }

    // Validate that we have at least one patient
    if (resources.patient.length === 0) {
      throw new BadRequestException(
        'Bundle must contain at least one Patient resource',
      );
    }

    if (resources.patient.length > 1) {
      throw new BadRequestException(
        'Bundle contains multiple Patient resources. Only one patient per bundle is supported.',
      );
    }

    const patient = resources.patient[0];
    const normalizedPatient = this.clinicalService.normalizePatient(patient);

    // Normalize all resources
    const normalizedObservations = resources.observations.map((obs) =>
      this.clinicalService.normalizeObservation(obs),
    );
    const normalizedConditions = resources.conditions.map((cond) =>
      this.clinicalService.normalizeCondition(cond),
    );
    const normalizedAllergies = resources.allergies.map((allergy) =>
      this.clinicalService.normalizeAllergy(allergy),
    );
    const normalizedMedications = resources.medications.map((med) =>
      this.clinicalService.normalizeMedication(med),
    );
    const normalizedProcedures = resources.procedures.map((proc) =>
      this.clinicalService.normalizeProcedure(proc),
    );
    const normalizedEncounters = resources.encounters.map((enc) =>
      this.clinicalService.normalizeEncounter(enc),
    );
    const normalizedDiagnosticReports = resources.diagnosticReports.map(
      (report) => this.clinicalService.normalizeDiagnosticReport(report),
    );

    // Upsert patient
    const dbPatient = await this.upsertPatient(normalizedPatient);

    // Upsert all related data in parallel
    await Promise.all([
      this.upsertObservations(dbPatient.id, normalizedObservations),
      this.upsertConditions(dbPatient.id, normalizedConditions),
      this.upsertAllergies(dbPatient.id, normalizedAllergies),
      this.upsertMedications(dbPatient.id, normalizedMedications),
      this.upsertProcedures(dbPatient.id, normalizedProcedures),
      this.upsertEncounters(dbPatient.id, normalizedEncounters),
      this.upsertDiagnosticReports(dbPatient.id, normalizedDiagnosticReports),
    ]);

    this.logger.log(
      `Successfully ingested FHIR bundle for patient ${dbPatient.epicId}`,
    );

    // Trigger risk rule evaluation
    let riskEvaluation: any | null = null;
    try {
      this.logger.log(
        `Triggering risk rule evaluation for patient: ${dbPatient.id}`,
      );
      riskEvaluation = await this.riskEngineService.evaluatePatientRules(
        dbPatient.id,
      );
      this.logger.log(
        `Risk evaluation complete: ${riskEvaluation.matchedRulesCount} rules matched, total score: ${riskEvaluation.totalScore}`,
      );
    } catch (error) {
      this.logger.error(
        `Error evaluating risk rules for patient ${dbPatient.id}: ${error.message}`,
        error.stack,
      );
      // Don't fail the ingestion if risk evaluation fails
    }

    return {
      success: true,
      patientId: dbPatient.id,
      epicId: dbPatient.epicId,
      ingested: {
        patient: 1,
        observations: normalizedObservations.length,
        conditions: normalizedConditions.length,
        allergies: normalizedAllergies.length,
        medications: normalizedMedications.length,
        procedures: normalizedProcedures.length,
        encounters: normalizedEncounters.length,
        diagnosticReports: normalizedDiagnosticReports.length,
      },
      riskEvaluation: riskEvaluation
        ? {
            totalScore: riskEvaluation.totalScore,
            matchedRulesCount: riskEvaluation.matchedRulesCount,
            highestRiskLevel: riskEvaluation.highestRiskLevel,
          }
        : undefined,
    };
  }

  /**
   * Ingest single FHIR resource
   */
  private async ingestFhirResource(resource: any) {
    const resourceType = resource.resourceType;

    if (!resourceType) {
      throw new BadRequestException(
        'Resource must have a resourceType property',
      );
    }

    // For single resources, we need to find or create a patient
    let patientId: string | undefined;
    let epicId: string | undefined;

    // Extract patient reference from resource
    const patientRef =
      resource.subject?.reference ||
      resource.patient?.reference ||
      resource.subject;

    if (patientRef) {
      // Extract patient ID from reference (format: "Patient/123" or just "123")
      const refParts = patientRef.split('/');
      const refPatientId = refParts[refParts.length - 1];

      // Try to find existing patient
      try {
        const existingPatient = await this.prisma.patient.findUnique({
          where: { epicId: refPatientId },
        });
        if (existingPatient) {
          patientId = existingPatient.id;
          epicId = existingPatient.epicId;
        }
      } catch (error) {
        // Patient not found, will need to create one
      }
    }

    // If patient doesn't exist, we can't ingest the resource
    if (!patientId && resourceType !== 'Patient') {
      throw new BadRequestException(
        `Cannot ingest ${resourceType} resource without a Patient. Please provide a Patient resource first or include patient reference.`,
      );
    }

    switch (resourceType) {
      case 'Patient':
        const normalizedPatient = this.clinicalService.normalizePatient(
          resource as FhirPatient,
        );
        const dbPatient = await this.upsertPatient(normalizedPatient);
        return {
          success: true,
          patientId: dbPatient.id,
          epicId: dbPatient.epicId,
          ingested: { patient: 1 },
        };

      case 'Observation':
        if (!patientId) {
          throw new BadRequestException('Patient ID required for Observation');
        }
        const normalizedObs = this.clinicalService.normalizeObservation(
          resource as FhirObservation,
        );
        await this.upsertObservations(patientId, [normalizedObs]);
        return {
          success: true,
          patientId,
          epicId,
          ingested: { observations: 1 },
        };

      case 'Condition':
        if (!patientId) {
          throw new BadRequestException('Patient ID required for Condition');
        }
        const normalizedCond = this.clinicalService.normalizeCondition(
          resource as FhirCondition,
        );
        await this.upsertConditions(patientId, [normalizedCond]);
        return {
          success: true,
          patientId,
          epicId,
          ingested: { conditions: 1 },
        };

      case 'AllergyIntolerance':
        if (!patientId) {
          throw new BadRequestException(
            'Patient ID required for AllergyIntolerance',
          );
        }
        const normalizedAllergy = this.clinicalService.normalizeAllergy(
          resource as FhirAllergyIntolerance,
        );
        await this.upsertAllergies(patientId, [normalizedAllergy]);
        return {
          success: true,
          patientId,
          epicId,
          ingested: { allergies: 1 },
        };

      case 'MedicationStatement':
        if (!patientId) {
          throw new BadRequestException(
            'Patient ID required for MedicationStatement',
          );
        }
        const normalizedMed = this.clinicalService.normalizeMedication(
          resource as FhirMedicationStatement,
        );
        await this.upsertMedications(patientId, [normalizedMed]);
        return {
          success: true,
          patientId,
          epicId,
          ingested: { medications: 1 },
        };

      case 'Procedure':
        if (!patientId) {
          throw new BadRequestException('Patient ID required for Procedure');
        }
        const normalizedProc = this.clinicalService.normalizeProcedure(
          resource as FhirProcedure,
        );
        await this.upsertProcedures(patientId, [normalizedProc]);
        return {
          success: true,
          patientId,
          epicId,
          ingested: { procedures: 1 },
        };

      case 'Encounter':
        if (!patientId) {
          throw new BadRequestException('Patient ID required for Encounter');
        }
        const normalizedEnc = this.clinicalService.normalizeEncounter(
          resource as FhirEncounter,
        );
        await this.upsertEncounters(patientId, [normalizedEnc]);
        return {
          success: true,
          patientId,
          epicId,
          ingested: { encounters: 1 },
        };

      case 'DiagnosticReport':
        if (!patientId) {
          throw new BadRequestException(
            'Patient ID required for DiagnosticReport',
          );
        }
        const normalizedReport = this.clinicalService.normalizeDiagnosticReport(
          resource as FhirDiagnosticReport,
        );
        await this.upsertDiagnosticReports(patientId, [normalizedReport]);
        return {
          success: true,
          patientId,
          epicId,
          ingested: { diagnosticReports: 1 },
        };

      default:
        throw new BadRequestException(
          `Unsupported resource type: ${resourceType}`,
        );
    }
  }

  // Helper methods for upserting data (reused from server.service.ts pattern)
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
    for (const obs of observations) {
      // Ensure required fields are present
      if (!obs.value || !obs.date || !obs.status) {
        throw new BadRequestException(
          `Observation ${obs.id} is missing required fields: value, date, and status are required`,
        );
      }
      
      const testName = obs.display || obs.code;
      if (!testName) {
        throw new BadRequestException(
          `Observation ${obs.id} is missing required field: testName (display or code) is required`,
        );
      }

      await this.prisma.observation.upsert({
        where: { epicId: obs.id },
        update: {
          testName, // Required field - use display or code
          value: String(obs.value), // Required field
          date: new Date(obs.date), // Required field
          status: obs.status, // Required field
          code: obs.code,
          display: obs.display,
          category: obs.category,
          unit: obs.unit,
        },
        create: {
          epicId: obs.id,
          patientId,
          testName, // Required field
          value: String(obs.value), // Required field
          date: new Date(obs.date), // Required field
          status: obs.status, // Required field
          code: obs.code,
          display: obs.display,
          category: obs.category,
          unit: obs.unit,
        },
      });
    }
  }

  private async upsertConditions(
    patientId: string,
    conditions: NormalizedCondition[],
  ) {
    for (const cond of conditions) {
      // Ensure required fields are present
      if (!cond.status) {
        throw new BadRequestException(
          `Condition ${cond.id} is missing required field: status is required`,
        );
      }
      
      const diagnosis = cond.display || cond.code;
      if (!diagnosis) {
        throw new BadRequestException(
          `Condition ${cond.id} is missing required field: diagnosis (display or code) is required`,
        );
      }

      await this.prisma.condition.upsert({
        where: { epicId: cond.id },
        update: {
          diagnosis, // Required field
          status: cond.status, // Required field
          onsetDate: cond.onsetDate ? new Date(cond.onsetDate) : null,
          recordedDate: cond.recordedDate
            ? new Date(cond.recordedDate)
            : null,
          code: cond.code,
          display: cond.display,
          category: cond.category,
        },
        create: {
          epicId: cond.id,
          patientId,
          diagnosis, // Required field
          status: cond.status, // Required field
          onsetDate: cond.onsetDate ? new Date(cond.onsetDate) : null,
          recordedDate: cond.recordedDate
            ? new Date(cond.recordedDate)
            : null,
          code: cond.code,
          display: cond.display,
          category: cond.category,
        },
      });
    }
  }

  private async upsertAllergies(
    patientId: string,
    allergies: NormalizedAllergy[],
  ) {
    for (const allergy of allergies) {
      // Ensure required fields are present
      if (!allergy.type || !allergy.status) {
        throw new BadRequestException(
          `Allergy ${allergy.id} is missing required fields: type and status are required`,
        );
      }
      
      const allergen = allergy.display || allergy.code;
      if (!allergen) {
        throw new BadRequestException(
          `Allergy ${allergy.id} is missing required field: allergen (display or code) is required`,
        );
      }

      await this.prisma.allergy.upsert({
        where: { epicId: allergy.id },
        update: {
          allergen, // Required field
          type: allergy.type, // Required field
          severity: allergy.criticality,
          status: allergy.status, // Required field
          recordedDate: allergy.recordedDate
            ? new Date(allergy.recordedDate)
            : null,
          code: allergy.code,
          display: allergy.display,
          category: allergy.category || [],
        },
        create: {
          epicId: allergy.id,
          patientId,
          allergen, // Required field
          type: allergy.type, // Required field
          severity: allergy.criticality,
          status: allergy.status, // Required field
          recordedDate: allergy.recordedDate
            ? new Date(allergy.recordedDate)
            : null,
          code: allergy.code,
          display: allergy.display,
          category: allergy.category || [],
        },
      });
    }
  }

  private async upsertMedications(
    patientId: string,
    medications: NormalizedMedication[],
  ) {
    for (const med of medications) {
      // Ensure required fields are present
      if (!med.status) {
        throw new BadRequestException(
          `Medication ${med.id} is missing required field: status is required`,
        );
      }
      
      const medication = med.display || med.code;
      if (!medication) {
        throw new BadRequestException(
          `Medication ${med.id} is missing required field: medication (display or code) is required`,
        );
      }

      await this.prisma.medication.upsert({
        where: { epicId: med.id },
        update: {
          medication, // Required field
          status: med.status, // Required field
          dosage: med.dosage,
          route: med.route,
          startDate: med.startDate ? new Date(med.startDate) : null,
          endDate: med.endDate ? new Date(med.endDate) : null,
          dateAsserted: med.dateAsserted ? new Date(med.dateAsserted) : null,
          code: med.code,
          display: med.display,
        },
        create: {
          epicId: med.id,
          patientId,
          medication, // Required field
          status: med.status, // Required field
          dosage: med.dosage,
          route: med.route,
          startDate: med.startDate ? new Date(med.startDate) : null,
          endDate: med.endDate ? new Date(med.endDate) : null,
          dateAsserted: med.dateAsserted ? new Date(med.dateAsserted) : null,
          code: med.code,
          display: med.display,
        },
      });
    }
  }

  private async upsertProcedures(
    patientId: string,
    procedures: NormalizedProcedure[],
  ) {
    for (const proc of procedures) {
      // Ensure required fields are present
      if (!proc.status) {
        throw new BadRequestException(
          `Procedure ${proc.id} is missing required field: status is required`,
        );
      }
      
      const procedure = proc.display || proc.code;
      if (!procedure) {
        throw new BadRequestException(
          `Procedure ${proc.id} is missing required field: procedure (display or code) is required`,
        );
      }

      await this.prisma.procedure.upsert({
        where: { epicId: proc.id },
        update: {
          procedure, // Required field
          status: proc.status, // Required field
          date: proc.performedDate ? new Date(proc.performedDate) : null,
          outcome: proc.outcome,
          code: proc.code,
          display: proc.display,
          category: proc.category,
        },
        create: {
          epicId: proc.id,
          patientId,
          procedure, // Required field
          status: proc.status, // Required field
          date: proc.performedDate ? new Date(proc.performedDate) : null,
          outcome: proc.outcome,
          code: proc.code,
          display: proc.display,
          category: proc.category,
        },
      });
    }
  }

  private async upsertEncounters(
    patientId: string,
    encounters: NormalizedEncounter[],
  ) {
    for (const enc of encounters) {
      // Ensure required fields are present
      if (!enc.status) {
        throw new BadRequestException(
          `Encounter ${enc.id} is missing required field: status is required`,
        );
      }
      
      // visitType is required in the database - use type or class as fallback
      const visitType = enc.type || enc.class;
      if (!visitType) {
        throw new BadRequestException(
          `Encounter ${enc.id} is missing required field: visitType (type or class) is required`,
        );
      }

      await this.prisma.encounter.upsert({
        where: { epicId: enc.id },
        update: {
          visitType, // Required field - use type or class
          reason: enc.reason,
          startDate: enc.startDate ? new Date(enc.startDate) : null,
          endDate: enc.endDate ? new Date(enc.endDate) : null,
          status: enc.status, // Required field
          type: enc.type,
          class: enc.class,
        },
        create: {
          epicId: enc.id,
          patientId,
          visitType, // Required field - use type or class
          reason: enc.reason,
          startDate: enc.startDate ? new Date(enc.startDate) : null,
          endDate: enc.endDate ? new Date(enc.endDate) : null,
          status: enc.status, // Required field
          type: enc.type,
          class: enc.class,
        },
      });
    }
  }

  private async upsertDiagnosticReports(
    patientId: string,
    reports: NormalizedDiagnosticReport[],
  ) {
    for (const report of reports) {
      // Ensure required fields are present
      if (!report.status) {
        throw new BadRequestException(
          `DiagnosticReport ${report.id} is missing required field: status is required`,
        );
      }
      
      const reportName = report.display || report.code;
      if (!reportName) {
        throw new BadRequestException(
          `DiagnosticReport ${report.id} is missing required field: reportName (display or code) is required`,
        );
      }

      await this.prisma.diagnosticReport.upsert({
        where: { epicId: report.id },
        update: {
          reportName, // Required field
          status: report.status, // Required field
          date: report.effectiveDate
            ? new Date(report.effectiveDate)
            : report.issuedDate
              ? new Date(report.issuedDate)
              : null,
          conclusion: report.conclusion,
          code: report.code,
          display: report.display,
          category: report.category,
          effectiveDate: report.effectiveDate
            ? new Date(report.effectiveDate)
            : null,
          issuedDate: report.issuedDate
            ? new Date(report.issuedDate)
            : null,
        },
        create: {
          epicId: report.id,
          patientId,
          reportName, // Required field
          status: report.status, // Required field
          date: report.effectiveDate
            ? new Date(report.effectiveDate)
            : report.issuedDate
              ? new Date(report.issuedDate)
              : null,
          conclusion: report.conclusion,
          code: report.code,
          display: report.display,
          category: report.category,
          effectiveDate: report.effectiveDate
            ? new Date(report.effectiveDate)
            : null,
          issuedDate: report.issuedDate
            ? new Date(report.issuedDate)
            : null,
        },
      });
    }
  }

  /**
   * Bulk ingest simplified data structure - supports multiple patients
   * @param bulkData - Simplified bulk data structure
   */
  async bulkIngest(bulkData: BulkIngestDto): Promise<{
    success: boolean;
    patients: Array<{
      patientId: string;
      epicId: string;
      ingested: {
        patient?: number;
        observations?: number;
        conditions?: number;
        allergies?: number;
        medications?: number;
        procedures?: number;
        encounters?: number;
        diagnosticReports?: number;
      };
      riskEvaluation?: {
        totalScore: number;
        matchedRulesCount: number;
        highestRiskLevel: string | null;
      };
    }>;
  }> {
    try {
      // Group clinical data by patientEpicId
      const dataByPatient = new Map<string, {
        patient?: SimplePatientDto;
        observations: SimpleObservationDto[];
        conditions: SimpleConditionDto[];
        allergies: SimpleAllergyDto[];
        medications: SimpleMedicationDto[];
        procedures: SimpleProcedureDto[];
        encounters: SimpleEncounterDto[];
        diagnosticReports: SimpleDiagnosticReportDto[];
      }>();

      // Process patients array - create entries for each patient
      if (bulkData.patients) {
        for (const patient of bulkData.patients) {
          if (!patient.epicId) {
            throw new BadRequestException(
              'All patients must have an epicId',
            );
          }
          if (!dataByPatient.has(patient.epicId)) {
            dataByPatient.set(patient.epicId, {
              patient,
              observations: [],
              conditions: [],
              allergies: [],
              medications: [],
              procedures: [],
              encounters: [],
              diagnosticReports: [],
            });
          } else {
            // Merge patient info if already exists
            const existing = dataByPatient.get(patient.epicId)!;
            existing.patient = { ...existing.patient, ...patient };
          }
        }
      }

      // Helper function to find patient epicId from existing clinical data using item's epicId
      const findPatientEpicIdFromClinicalData = async (
        itemEpicId: string,
        dataKey: 'observations' | 'conditions' | 'allergies' | 'medications' | 'procedures' | 'encounters' | 'diagnosticReports',
      ): Promise<string | null> => {
        try {
          let existingRecord: any = null;
          
          switch (dataKey) {
            case 'observations':
              existingRecord = await this.prisma.observation.findUnique({
                where: { epicId: itemEpicId },
                include: { patient: true },
              });
              break;
            case 'conditions':
              existingRecord = await this.prisma.condition.findUnique({
                where: { epicId: itemEpicId },
                include: { patient: true },
              });
              break;
            case 'allergies':
              existingRecord = await this.prisma.allergy.findUnique({
                where: { epicId: itemEpicId },
                include: { patient: true },
              });
              break;
            case 'medications':
              existingRecord = await this.prisma.medication.findUnique({
                where: { epicId: itemEpicId },
                include: { patient: true },
              });
              break;
            case 'procedures':
              existingRecord = await this.prisma.procedure.findUnique({
                where: { epicId: itemEpicId },
                include: { patient: true },
              });
              break;
            case 'encounters':
              existingRecord = await this.prisma.encounter.findUnique({
                where: { epicId: itemEpicId },
                include: { patient: true },
              });
              break;
            case 'diagnosticReports':
              existingRecord = await this.prisma.diagnosticReport.findUnique({
                where: { epicId: itemEpicId },
                include: { patient: true },
              });
              break;
          }
          
          return existingRecord?.patient?.epicId || null;
        } catch (error) {
          return null;
        }
      };

      // Group clinical data by patientEpicId - use item's epicId as patient identifier
      const groupDataByPatient = async (
        items: any[] | undefined,
        dataKey: 'observations' | 'conditions' | 'allergies' | 'medications' | 'procedures' | 'encounters' | 'diagnosticReports',
      ) => {
        if (!items) return;
        for (const item of items) {
          // Use patientEpicId from item if explicitly provided, otherwise use item's epicId as patient identifier
          const patientEpicId = item.patientEpicId || item.epicId;
          
          // Verify patient exists with this epicId
          const patientExists = await this.prisma.patient.findUnique({
            where: { epicId: patientEpicId },
          });
          
          if (!patientExists) {
            // Try to find patient from existing clinical data (in case item.epicId is the clinical data ID, not patient ID)
            const foundPatientEpicId = await findPatientEpicIdFromClinicalData(item.epicId, dataKey);
            if (foundPatientEpicId) {
              // Use the found patient epicId
              const finalPatientEpicId = foundPatientEpicId;
              if (!dataByPatient.has(finalPatientEpicId)) {
                dataByPatient.set(finalPatientEpicId, {
                  observations: [],
                  conditions: [],
                  allergies: [],
                  medications: [],
                  procedures: [],
                  encounters: [],
                  diagnosticReports: [],
                });
              }
              const patientData = dataByPatient.get(finalPatientEpicId)!;
              patientData[dataKey].push(item);
              continue;
            } else {
              throw new BadRequestException(
                `Patient with epicId ${patientEpicId} does not exist. Please create the patient first or provide patientEpicId in the item.`,
              );
            }
          }
          
          if (!dataByPatient.has(patientEpicId)) {
            dataByPatient.set(patientEpicId, {
              observations: [],
              conditions: [],
              allergies: [],
              medications: [],
              procedures: [],
              encounters: [],
              diagnosticReports: [],
            });
          }
          const patientData = dataByPatient.get(patientEpicId)!;
          patientData[dataKey].push(item);
        }
      };

      // Group all clinical data by patientEpicId (await all async lookups)
      await Promise.all([
        groupDataByPatient(bulkData.observations, 'observations'),
        groupDataByPatient(bulkData.conditions, 'conditions'),
        groupDataByPatient(bulkData.allergies, 'allergies'),
        groupDataByPatient(bulkData.medications, 'medications'),
        groupDataByPatient(bulkData.procedures, 'procedures'),
        groupDataByPatient(bulkData.encounters, 'encounters'),
        groupDataByPatient(bulkData.diagnosticReports, 'diagnosticReports'),
      ]);

      if (dataByPatient.size === 0) {
        throw new BadRequestException(
          'No patient data provided. Provide patients array or clinical data with patientEpicId.',
        );
      }

      this.logger.log(
        `Received bulk ingestion request for ${dataByPatient.size} patient(s)`,
      );

      // Process each patient
      const results = await Promise.all(
        Array.from(dataByPatient.entries()).map(async ([epicId, patientData]) => {
          return this.processPatientBulkData(epicId, patientData);
        }),
      );

      return {
        success: true,
        patients: results,
      };
    } catch (error) {
      this.logger.error(
        `Error bulk ingesting data: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to bulk ingest data: ${error.message}`,
      );
    }
  }

  /**
   * Process bulk data for a single patient
   */
  private async processPatientBulkData(
    epicId: string,
    patientData: {
      patient?: SimplePatientDto;
      observations: SimpleObservationDto[];
      conditions: SimpleConditionDto[];
      allergies: SimpleAllergyDto[];
      medications: SimpleMedicationDto[];
      procedures: SimpleProcedureDto[];
      encounters: SimpleEncounterDto[];
      diagnosticReports: SimpleDiagnosticReportDto[];
    },
  ): Promise<{
    patientId: string;
    epicId: string;
    ingested: {
      patient?: number;
      observations?: number;
      conditions?: number;
      allergies?: number;
      medications?: number;
      procedures?: number;
      encounters?: number;
      diagnosticReports?: number;
    };
    riskEvaluation?: {
      totalScore: number;
      matchedRulesCount: number;
      highestRiskLevel: string | null;
    };
  }> {
    // Check if patient information is provided (full patient data) or just epicId
    const hasPatientInfo =
      patientData.patient &&
      (patientData.patient.name ||
        patientData.patient.firstName ||
        patientData.patient.lastName ||
        patientData.patient.birthDate ||
        patientData.patient.gender ||
        patientData.patient.identifiers);

    let dbPatient;

    if (hasPatientInfo && patientData.patient) {
      // User provided patient information - create or update the patient
      this.logger.log(
        `Patient information provided, creating/updating patient: ${epicId}`,
      );

      // Convert simplified patient to normalized format
      const normalizedPatient: NormalizedPatient = {
        id: epicId,
        name: patientData.patient.name,
        firstName: patientData.patient.firstName,
        lastName: patientData.patient.lastName,
        birthDate: patientData.patient.birthDate,
        gender: patientData.patient.gender,
        identifiers: patientData.patient.identifiers,
      };

      // Upsert patient (create if doesn't exist, update if exists)
      dbPatient = await this.upsertPatient(normalizedPatient);
    } else {
      // User only provided epicId - check if patient exists
      this.logger.log(
        `Only epicId provided, checking if patient exists: ${epicId}`,
      );

      const existingPatient = await this.prisma.patient.findUnique({
        where: { epicId },
      });

      if (!existingPatient) {
        throw new BadRequestException(
          `Patient with epicId ${epicId} does not exist. Please provide patient information to create the patient, or ensure the patient exists in the system.`,
        );
      }

      dbPatient = existingPatient;
    }

    // Convert and upsert observations - preserve all required fields
    const normalizedObservations: NormalizedObservation[] =
      patientData.observations.map((obs) => {
        // Ensure required fields are present
        if (!obs.testName || !obs.value || !obs.date || !obs.status) {
          throw new BadRequestException(
            `Observation ${obs.epicId} is missing required fields: testName, value, date, and status are required`,
          );
        }
        return {
          id: obs.epicId,
          code: obs.code || obs.testName,
          display: obs.display || obs.testName,
          category: obs.category,
          value: obs.value, // Required field
          unit: obs.unit,
          date: obs.date, // Required field
          status: obs.status, // Required field
        };
      });

    // Convert and upsert conditions - preserve all required fields
    const normalizedConditions: NormalizedCondition[] =
      patientData.conditions.map((cond) => {
        // Ensure required fields are present
        if (!cond.diagnosis || !cond.status) {
          throw new BadRequestException(
            `Condition ${cond.epicId} is missing required fields: diagnosis and status are required`,
          );
        }
        return {
          id: cond.epicId,
          code: cond.code || cond.diagnosis,
          display: cond.display || cond.diagnosis,
          category: cond.category,
          status: cond.status, // Required field
          onsetDate: cond.onsetDate,
          recordedDate: cond.recordedDate,
        };
      });

    // Convert and upsert allergies - preserve all required fields
    const normalizedAllergies: NormalizedAllergy[] = patientData.allergies.map(
      (allergy) => {
        // Ensure required fields are present
        if (!allergy.allergen || !allergy.type || !allergy.status) {
          throw new BadRequestException(
            `Allergy ${allergy.epicId} is missing required fields: allergen, type, and status are required`,
          );
        }
        return {
          id: allergy.epicId,
          code: allergy.code || allergy.allergen,
          display: allergy.display || allergy.allergen,
          type: allergy.type, // Required field
          category: allergy.category || [],
          criticality: allergy.criticality || allergy.severity,
          status: allergy.status, // Required field
          recordedDate: allergy.recordedDate,
        };
      },
    );

    // Convert and upsert medications - preserve all required fields
    const normalizedMedications: NormalizedMedication[] =
      patientData.medications.map((med) => {
        // Ensure required fields are present
        if (!med.medication || !med.status) {
          throw new BadRequestException(
            `Medication ${med.epicId} is missing required fields: medication and status are required`,
          );
        }
        return {
          id: med.epicId,
          code: med.code || med.medication,
          display: med.display || med.medication,
          status: med.status, // Required field
          startDate: med.startDate,
          endDate: med.endDate,
          dateAsserted: med.dateAsserted,
          dosage: med.dosage,
          route: med.route,
        };
      });

    // Convert and upsert procedures - preserve all required fields
    const normalizedProcedures: NormalizedProcedure[] =
      patientData.procedures.map((proc) => {
        // Ensure required fields are present
        if (!proc.procedure || !proc.status) {
          throw new BadRequestException(
            `Procedure ${proc.epicId} is missing required fields: procedure and status are required`,
          );
        }
        return {
          id: proc.epicId,
          code: proc.code || proc.procedure,
          display: proc.display || proc.procedure,
          status: proc.status, // Required field
          category: proc.category,
          performedDate: proc.performedDate || proc.date,
          outcome: proc.outcome,
        };
      });

    // Convert and upsert encounters - preserve all required fields
    const normalizedEncounters: NormalizedEncounter[] =
      patientData.encounters.map((enc) => {
        // Ensure required fields are present
        if (!enc.visitType || !enc.status) {
          throw new BadRequestException(
            `Encounter ${enc.epicId} is missing required fields: visitType and status are required`,
          );
        }
        return {
          id: enc.epicId,
          status: enc.status, // Required field
          type: enc.type || enc.visitType, // Map visitType to type if type is not provided
          class: enc.class,
          startDate: enc.startDate,
          endDate: enc.endDate,
          reason: enc.reason,
        };
      });

    // Convert and upsert diagnostic reports - preserve all required fields
    const normalizedDiagnosticReports: NormalizedDiagnosticReport[] =
      patientData.diagnosticReports.map((report) => {
        // Ensure required fields are present
        if (!report.reportName || !report.status) {
          throw new BadRequestException(
            `DiagnosticReport ${report.epicId} is missing required fields: reportName and status are required`,
          );
        }
        return {
          id: report.epicId,
          code: report.code || report.reportName,
          display: report.display || report.reportName,
          status: report.status, // Required field
          category: report.category,
          effectiveDate: report.effectiveDate || report.date,
          issuedDate: report.issuedDate,
          conclusion: report.conclusion,
        };
      });

    // Upsert all related data in parallel
    await Promise.all([
      this.upsertObservations(dbPatient.id, normalizedObservations),
      this.upsertConditions(dbPatient.id, normalizedConditions),
      this.upsertAllergies(dbPatient.id, normalizedAllergies),
      this.upsertMedications(dbPatient.id, normalizedMedications),
      this.upsertProcedures(dbPatient.id, normalizedProcedures),
      this.upsertEncounters(dbPatient.id, normalizedEncounters),
      this.upsertDiagnosticReports(dbPatient.id, normalizedDiagnosticReports),
    ]);

    this.logger.log(
      `Successfully bulk ingested data for patient ${dbPatient.epicId}`,
    );

    // Trigger risk rule evaluation
    let riskEvaluation: any | null = null;
    try {
      this.logger.log(
        `Triggering risk rule evaluation for patient: ${dbPatient.id}`,
      );
      riskEvaluation = await this.riskEngineService.evaluatePatientRules(
        dbPatient.id,
      );
      this.logger.log(
        `Risk evaluation complete: ${riskEvaluation.matchedRulesCount} rules matched, total score: ${riskEvaluation.totalScore}`,
      );
    } catch (error) {
      this.logger.error(
        `Error evaluating risk rules for patient ${dbPatient.id}: ${error.message}`,
        error.stack,
      );
      // Don't fail the ingestion if risk evaluation fails
    }

    return {
      patientId: dbPatient.id,
      epicId: dbPatient.epicId,
      ingested: {
        patient: hasPatientInfo ? 1 : 0,
        observations: normalizedObservations.length,
        conditions: normalizedConditions.length,
        allergies: normalizedAllergies.length,
        medications: normalizedMedications.length,
        procedures: normalizedProcedures.length,
        encounters: normalizedEncounters.length,
        diagnosticReports: normalizedDiagnosticReports.length,
      },
      riskEvaluation: riskEvaluation
        ? {
            totalScore: riskEvaluation.totalScore,
            matchedRulesCount: riskEvaluation.matchedRulesCount,
            highestRiskLevel: riskEvaluation.highestRiskLevel,
          }
        : undefined,
    };
  }
}

