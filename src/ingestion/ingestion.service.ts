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
      await this.prisma.observation.upsert({
        where: { epicId: obs.id },
        update: {
          testName: obs.display || obs.code,
          value: String(obs.value || ''),
          date: obs.date ? new Date(obs.date) : new Date(),
          status: obs.status,
          code: obs.code,
          display: obs.display,
          category: obs.category,
          unit: obs.unit,
        },
        create: {
          epicId: obs.id,
          patientId,
          testName: obs.display || obs.code,
          value: String(obs.value || ''),
          date: obs.date ? new Date(obs.date) : new Date(),
          status: obs.status,
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
      await this.prisma.condition.upsert({
        where: { epicId: cond.id },
        update: {
          diagnosis: cond.display || cond.code,
          status: cond.status || 'unknown',
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
          diagnosis: cond.display || cond.code,
          status: cond.status || 'unknown',
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
      await this.prisma.allergy.upsert({
        where: { epicId: allergy.id },
        update: {
          allergen: allergy.display || allergy.code,
          type: allergy.type,
          severity: allergy.criticality,
          status: allergy.status || 'unknown',
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
          allergen: allergy.display || allergy.code,
          type: allergy.type || '',
          severity: allergy.criticality,
          status: allergy.status || 'unknown',
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
      await this.prisma.medication.upsert({
        where: { epicId: med.id },
        update: {
          medication: med.display || med.code,
          status: med.status,
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
          medication: med.display || med.code,
          status: med.status,
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
      await this.prisma.procedure.upsert({
        where: { epicId: proc.id },
        update: {
          procedure: proc.display || proc.code,
          status: proc.status,
          date: proc.performedDate ? new Date(proc.performedDate) : null,
          outcome: proc.outcome,
          code: proc.code,
          display: proc.display,
          category: proc.category,
        },
        create: {
          epicId: proc.id,
          patientId,
          procedure: proc.display || proc.code,
          status: proc.status,
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
      await this.prisma.encounter.upsert({
        where: { epicId: enc.id },
        update: {
          visitType: enc.type || enc.class || 'Unknown',
          reason: enc.reason,
          startDate: enc.startDate ? new Date(enc.startDate) : null,
          endDate: enc.endDate ? new Date(enc.endDate) : null,
          status: enc.status,
          type: enc.type,
          class: enc.class,
        },
        create: {
          epicId: enc.id,
          patientId,
          visitType: enc.type || enc.class || 'Unknown',
          reason: enc.reason,
          startDate: enc.startDate ? new Date(enc.startDate) : null,
          endDate: enc.endDate ? new Date(enc.endDate) : null,
          status: enc.status,
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
      await this.prisma.diagnosticReport.upsert({
        where: { epicId: report.id },
        update: {
          reportName: report.display || report.code,
          status: report.status,
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
          reportName: report.display || report.code,
          status: report.status,
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
}

