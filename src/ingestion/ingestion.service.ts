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
        const result = await this.ingestFhirBundle(fhirData as FhirBundle);
        await this.recordIngestionStats('FHIR_JSON_BUNDLE', result.ingested);
        return result;
      } else {
        const result = await this.ingestFhirResource(fhirData);
        await this.recordIngestionStats('FHIR_JSON_RESOURCE', result.ingested);
        return result;
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
      const testName = obs.display || obs.code;

      // Always insert a new observation row, even if epicId is duplicated
      await this.prisma.observation.create({
        data: {
          epicId: obs.id,
          patientId,
          ...(testName && { testName }),
          ...(obs.value != null && { value: String(obs.value) }),
          ...(obs.date && { date: new Date(obs.date) }),
          ...(obs.status && { status: obs.status }),
          code: obs.code,
          display: obs.display,
          category: obs.category,
          unit: obs.unit,
        } as any,
      });
    }
  }

  private async upsertConditions(
    patientId: string,
    conditions: NormalizedCondition[],
  ) {
    for (const cond of conditions) {
      const diagnosis = cond.display || cond.code;

      // Always insert a new condition row, even if epicId is duplicated
      await this.prisma.condition.create({
        data: {
          epicId: cond.id,
          patientId,
          ...(diagnosis && { diagnosis }),
          ...(cond.status && { status: cond.status }),
          onsetDate: cond.onsetDate ? new Date(cond.onsetDate) : null,
          recordedDate: cond.recordedDate
            ? new Date(cond.recordedDate)
            : null,
          code: cond.code,
          display: cond.display,
          category: cond.category,
        } as any,
      });
    }
  }

  private async upsertAllergies(
    patientId: string,
    allergies: NormalizedAllergy[],
  ) {
    for (const allergy of allergies) {
      const allergen = allergy.display || allergy.code;

      // Always insert a new allergy row, even if epicId is duplicated
      await this.prisma.allergy.create({
        data: {
          epicId: allergy.id,
          patientId,
          ...(allergen && { allergen }),
          ...(allergy.type && { type: allergy.type }),
          severity: allergy.criticality,
          ...(allergy.status && { status: allergy.status }),
          recordedDate: allergy.recordedDate
            ? new Date(allergy.recordedDate)
            : null,
          code: allergy.code,
          display: allergy.display,
          category: allergy.category || [],
        } as any,
      });
    }
  }

  private async upsertMedications(
    patientId: string,
    medications: NormalizedMedication[],
  ) {
    for (const med of medications) {
      const medication = med.display || med.code;

      // Always insert a new medication row, even if epicId is duplicated
      await this.prisma.medication.create({
        data: {
          epicId: med.id,
          patientId,
          ...(medication && { medication }),
          ...(med.status && { status: med.status }),
          dosage: med.dosage,
          route: med.route,
          startDate: med.startDate ? new Date(med.startDate) : null,
          endDate: med.endDate ? new Date(med.endDate) : null,
          dateAsserted: med.dateAsserted ? new Date(med.dateAsserted) : null,
          code: med.code,
          display: med.display,
          // Redflag-specific medication safety fields
          controlledSubstancePrescribed:
            med.controlledSubstancePrescribed ?? null,
          refillCount: med.refillCount ?? null,
          autoRefillEnabled: med.autoRefillEnabled ?? null,
          medicationAdherence: med.medicationAdherence ?? null,
          clinicalDecisionSupport: med.clinicalDecisionSupport ?? null,
          overrideReason: med.overrideReason ?? null,
          quantity: med.quantity ?? null,
          substanceCode: med.substanceCode ?? null,
          substanceExpiry: med.substanceExpiry
            ? new Date(med.substanceExpiry)
            : null,
          prescriptionWritten: med.prescriptionWritten ?? null,
        } as any,
      });
    }
  }

  private async upsertProcedures(
    patientId: string,
    procedures: NormalizedProcedure[],
  ) {
    for (const proc of procedures) {
      const procedure = proc.display || proc.code;

      // Always insert a new procedure row, even if epicId is duplicated
      await this.prisma.procedure.create({
        data: {
          epicId: proc.id,
          patientId,
          ...(procedure && { procedure }),
          ...(proc.status && { status: proc.status }),
          date: proc.performedDate ? new Date(proc.performedDate) : null,
          outcome: proc.outcome,
          code: proc.code,
          display: proc.display,
          category: proc.category,
        } as any,
      });
    }
  }

  private async upsertEncounters(
    patientId: string,
    encounters: NormalizedEncounter[],
  ) {
    for (const enc of encounters) {
      const visitType = enc.type || enc.class;

      // Always insert a new encounter row, even if epicId is duplicated
      await this.prisma.encounter.create({
        data: {
          epicId: enc.id,
          patientId,
          ...(visitType && { visitType }),
          reason: enc.reason,
          startDate: enc.startDate ? new Date(enc.startDate) : null,
          endDate: enc.endDate ? new Date(enc.endDate) : null,
          ...(enc.status && { status: enc.status }),
          type: enc.type,
          class: enc.class,
          // FHIR Encounter core extensions
          priority: enc.priority,
          serviceType: enc.serviceType,
          subjectStatus: enc.subjectStatus,
          lengthMinutes: enc.lengthMinutes ?? null,
          serviceProvider: enc.serviceProvider,
          partOfId: enc.partOfId,
          // Telehealth & documentation fields
          practitionerName: enc.practitionerName,
          isTelehealth: enc.isTelehealth ?? null,
          telehealthId: enc.telehealthId,
          patientIdentityVerified: enc.patientIdentityVerified ?? null,
          consentObtained: enc.consentObtained ?? null,
          sessionRecordingConsent: enc.sessionRecordingConsent ?? null,
          providerLocation: enc.providerLocation,
          providerLocationState: enc.providerLocationState,
          patientLocation: enc.patientLocation,
          patientLocationState: enc.patientLocationState,
          stateLicensureVerified: enc.stateLicensureVerified ?? null,
          crossStateLicense: enc.crossStateLicense ?? null,
          encounterType: enc.encounterType,
          sessionDurationMinutes: enc.sessionDurationMinutes ?? null,
          sessionStartTime: enc.sessionStartTime
            ? new Date(enc.sessionStartTime)
            : null,
          sessionEndTime: enc.sessionEndTime
            ? new Date(enc.sessionEndTime)
            : null,
          mentalHealthScreening: enc.mentalHealthScreening,
          substanceUseScreening: enc.substanceUseScreening,
          chiefComplaint: enc.chiefComplaint,
          followUpScheduled: enc.followUpScheduled ?? null,
          carePlanUpdated: enc.carePlanUpdated ?? null,
          vitalSignsRecorded: enc.vitalSignsRecorded ?? null,
          outcomeMeasured: enc.outcomeMeasured,
          coordinationWithPcp: enc.coordinationWithPcp ?? null,
          clinicalNotesCompleted: enc.clinicalNotesCompleted,
          noteSignedDate: enc.noteSignedDate
            ? new Date(enc.noteSignedDate)
            : null,
          allergiesReviewed: enc.allergiesReviewed ?? null,
          technologyAssessment: enc.technologyAssessment,
          informedConsentType: enc.informedConsentType,
          clinicalDecisionMaker: enc.clinicalDecisionMaker,
          qualityMeasureMet: enc.qualityMeasureMet ?? null,
        } as any,
      });
    }
  }

  private async upsertDiagnosticReports(
    patientId: string,
    reports: NormalizedDiagnosticReport[],
  ) {
    for (const report of reports) {
      const reportName = report.display || report.code;

      // Always insert a new diagnostic report row, even if epicId is duplicated
      await this.prisma.diagnosticReport.create({
        data: {
          epicId: report.id,
          patientId,
          ...(reportName && { reportName }),
          ...(report.status && { status: report.status }),
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
        } as any,
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

      // Helper function to find patient epicId from existing clinical data using item's epicId.
      // epicId is no longer unique on these tables, so we must use findFirst (not findUnique).
      const findPatientEpicIdFromClinicalData = async (
        itemEpicId: string,
        dataKey:
          | 'observations'
          | 'conditions'
          | 'allergies'
          | 'medications'
          | 'procedures'
          | 'encounters'
          | 'diagnosticReports',
      ): Promise<string | null> => {
        try {
          let existingRecord: any = null;
          
          switch (dataKey) {
            case 'observations':
              existingRecord = await this.prisma.observation.findFirst({
                where: { epicId: itemEpicId },
                include: { patient: true },
              });
              break;
            case 'conditions':
              existingRecord = await this.prisma.condition.findFirst({
                where: { epicId: itemEpicId },
                include: { patient: true },
              });
              break;
            case 'allergies':
              existingRecord = await this.prisma.allergy.findFirst({
                where: { epicId: itemEpicId },
                include: { patient: true },
              });
              break;
            case 'medications':
              existingRecord = await this.prisma.medication.findFirst({
                where: { epicId: itemEpicId },
                include: { patient: true },
              });
              break;
            case 'procedures':
              existingRecord = await this.prisma.procedure.findFirst({
                where: { epicId: itemEpicId },
                include: { patient: true },
              });
              break;
            case 'encounters':
              existingRecord = await this.prisma.encounter.findFirst({
                where: { epicId: itemEpicId },
                include: { patient: true },
              });
              break;
            case 'diagnosticReports':
              existingRecord = await this.prisma.diagnosticReport.findFirst({
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

          // If we already have an entry for this patient epicId (from patients[] or previous items),
          // just append the item without hitting the database.
          if (!dataByPatient.has(patientEpicId)) {
            // If there is no explicit patient entry in the bulk payload,
            // fall back to existing database/clinical data lookup for backwards compatibility.
            if (!bulkData.patients) {
              // Verify patient exists with this epicId
              const patientExists = await this.prisma.patient.findUnique({
                where: { epicId: patientEpicId },
              });

              if (!patientExists) {
                // Try to find patient from existing clinical data (in case item.epicId is the clinical data ID, not patient ID)
                const foundPatientEpicId = await findPatientEpicIdFromClinicalData(
                  item.epicId,
                  dataKey,
                );
                if (foundPatientEpicId) {
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
                  const mappedPatientData = dataByPatient.get(finalPatientEpicId)!;
                  mappedPatientData[dataKey].push(item);
                  continue;
                } else {
                  throw new BadRequestException(
                    `Patient with epicId ${patientEpicId} does not exist. Please create the patient first or provide patientEpicId in the item.`,
                  );
                }
              }
            }

            // Either we already have patients[] in the payload (so we'll create/upsert later),
            // or the patient exists in the DB. In both cases, create an entry in the map.
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

      // Aggregate ingested counts across all patients for stats
      const aggregatedIngested = results.reduce(
        (acc, cur) => {
          acc.patient += cur.ingested.patient ?? 0;
          acc.observations += cur.ingested.observations ?? 0;
          acc.conditions += cur.ingested.conditions ?? 0;
          acc.allergies += cur.ingested.allergies ?? 0;
          acc.medications += cur.ingested.medications ?? 0;
          acc.procedures += cur.ingested.procedures ?? 0;
          acc.encounters += cur.ingested.encounters ?? 0;
          acc.diagnosticReports += cur.ingested.diagnosticReports ?? 0;
          return acc;
        },
        {
          patient: 0,
          observations: 0,
          conditions: 0,
          allergies: 0,
          medications: 0,
          procedures: 0,
          encounters: 0,
          diagnosticReports: 0,
        },
      );

      await this.recordIngestionStats('BULK', aggregatedIngested);

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

    // Convert and upsert observations
    const normalizedObservations: NormalizedObservation[] =
      patientData.observations.map((obs) => {
        return {
          id: obs.epicId,
          code: obs.code || obs.testName,
          display: obs.display || obs.testName,
          category: obs.category,
          value: obs.value, // Required field
          unit: obs.unit,
          date: obs.date, // Required field
          status: obs.status, // Optional in bulk DTO
        };
      }) as any;

    // Convert and upsert conditions
    const normalizedConditions: NormalizedCondition[] =
      patientData.conditions.map((cond) => {
        return {
          id: cond.epicId,
          code: cond.code || cond.diagnosis,
          display: cond.display || cond.diagnosis,
          category: cond.category,
          status: cond.status, // Required field
          onsetDate: cond.onsetDate,
          recordedDate: cond.recordedDate,
        };
      }) as any;

    // Convert and upsert allergies
    const normalizedAllergies: NormalizedAllergy[] = patientData.allergies.map(
      (allergy) => {
        return {
          id: allergy.epicId,
          code: allergy.code || allergy.allergen,
          display: allergy.display || allergy.allergen,
          type: allergy.type, // Required field
          category: allergy.category || [],
          criticality: allergy.criticality || allergy.severity,
          status: allergy.status, // Optional in bulk DTO
          recordedDate: allergy.recordedDate,
        };
      },
    ) as any;

    // Convert and upsert medications
    const normalizedMedications: NormalizedMedication[] =
      patientData.medications.map((med) => {
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
          controlledSubstancePrescribed: med.controlledSubstancePrescribed,
          refillCount: med.refillCount,
          autoRefillEnabled: med.autoRefillEnabled,
          medicationAdherence: med.medicationAdherence,
          clinicalDecisionSupport: med.clinicalDecisionSupport,
          overrideReason: med.overrideReason,
          quantity: med.quantity,
          substanceCode: med.substanceCode,
          substanceExpiry: med.substanceExpiry,
          prescriptionWritten: med.prescriptionWritten,
        };
      }) as any;

    // Convert and upsert procedures
    const normalizedProcedures: NormalizedProcedure[] =
      patientData.procedures.map((proc) => {
        return {
          id: proc.epicId,
          code: proc.code || proc.procedure,
          display: proc.display || proc.procedure,
          status: proc.status, // Required field
          category: proc.category,
          performedDate: proc.performedDate || proc.date,
          outcome: proc.outcome,
        };
      }) as any;

    // Convert and upsert encounters
    const normalizedEncounters: NormalizedEncounter[] =
      patientData.encounters.map((enc) => {
        return {
          id: enc.epicId,
          status: enc.status, // Required field
          type: enc.type || enc.visitType, // Map visitType to type if type is not provided
          class: enc.class,
          startDate: enc.startDate,
          endDate: enc.endDate,
          reason: enc.reason,
          priority: enc.priority,
          serviceType: enc.serviceType,
          subjectStatus: enc.subjectStatus,
          lengthMinutes: enc.lengthMinutes,
          serviceProvider: enc.serviceProvider,
          partOfId: enc.partOfId,
          practitionerName: enc.practitionerName,
          isTelehealth: enc.isTelehealth,
          telehealthId: enc.telehealthId,
          patientIdentityVerified: enc.patientIdentityVerified,
          consentObtained: enc.consentObtained,
          sessionRecordingConsent: enc.sessionRecordingConsent,
          providerLocation: enc.providerLocation,
          providerLocationState: enc.providerLocationState,
          patientLocation: enc.patientLocation,
          patientLocationState: enc.patientLocationState,
          stateLicensureVerified: enc.stateLicensureVerified,
          crossStateLicense: enc.crossStateLicense,
          encounterType: enc.encounterType,
          sessionDurationMinutes: enc.sessionDurationMinutes,
          sessionStartTime: enc.sessionStartTime,
          sessionEndTime: enc.sessionEndTime,
          mentalHealthScreening: enc.mentalHealthScreening,
          substanceUseScreening: enc.substanceUseScreening,
          chiefComplaint: enc.chiefComplaint,
          followUpScheduled: enc.followUpScheduled,
          carePlanUpdated: enc.carePlanUpdated,
          vitalSignsRecorded: enc.vitalSignsRecorded,
          outcomeMeasured: enc.outcomeMeasured,
          coordinationWithPcp: enc.coordinationWithPcp,
          clinicalNotesCompleted: enc.clinicalNotesCompleted,
          noteSignedDate: enc.noteSignedDate,
          allergiesReviewed: enc.allergiesReviewed,
          technologyAssessment: enc.technologyAssessment,
          informedConsentType: enc.informedConsentType,
          clinicalDecisionMaker: enc.clinicalDecisionMaker,
          qualityMeasureMet: enc.qualityMeasureMet,
        };
      }) as any;

    // Convert and upsert diagnostic reports
    const normalizedDiagnosticReports: NormalizedDiagnosticReport[] =
      patientData.diagnosticReports.map((report) => {
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
      }) as any;

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

    const result = {
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

    return result;
  }

  /**
   * Record ingestion statistics in the IngestionStat table.
   * This is used for tracking total and per-day ingestion volumes.
   */
  private async recordIngestionStats(
    source: string,
    ingested: {
      patient?: number;
      observations?: number;
      conditions?: number;
      allergies?: number;
      medications?: number;
      procedures?: number;
      encounters?: number;
      diagnosticReports?: number;
    },
  ) {
    try {
      await this.prisma.ingestionStat.create({
        data: {
          source,
          patients: ingested.patient ?? 0,
          observations: ingested.observations ?? 0,
          conditions: ingested.conditions ?? 0,
          allergies: ingested.allergies ?? 0,
          medications: ingested.medications ?? 0,
          procedures: ingested.procedures ?? 0,
          encounters: ingested.encounters ?? 0,
          diagnosticReports: ingested.diagnosticReports ?? 0,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to record ingestion stats for source ${source}: ${error.message}`,
        error.stack,
      );
      // Do not fail ingestion due to stats error
    }
  }
}

