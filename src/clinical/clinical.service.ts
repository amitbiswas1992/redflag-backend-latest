import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { FhirService, ForbiddenScopeException } from '../fhir/fhir.service';
import {
  NormalizedPatient,
  NormalizedPractitioner,
  NormalizedObservation,
  NormalizedCondition,
  NormalizedAllergy,
  NormalizedMedication,
  NormalizedProcedure,
  NormalizedEncounter,
  NormalizedDiagnosticReport,
  ClinicalDataResponse,
  DiagnosisDataResponse,
  BulkPatientResponse,
  HumanReadableClinicalData,
  HumanReadablePatient,
  HumanReadableObservation,
  HumanReadableCondition,
  HumanReadableAllergy,
  HumanReadableMedication,
  HumanReadableProcedure,
  HumanReadableEncounter,
  HumanReadableDiagnosticReport,
} from './interfaces/clinical.interface';
import {
  FhirPatient,
  FhirPractitioner,
  FhirObservation,
  FhirCondition,
  FhirAllergyIntolerance,
  FhirMedicationStatement,
  FhirProcedure,
  FhirEncounter,
  FhirDiagnosticReport,
} from '../fhir/interfaces/fhir.interface';

@Injectable()
export class ClinicalService {
  private readonly logger = new Logger(ClinicalService.name);

  constructor(private fhirService: FhirService) {}

  /**
   * Safely extract error message from an error object
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error';
  }

  /**
   * Get normalized patient information
   * @param patientId - Required patient ID
   */
  async getPatient(patientId: string): Promise<NormalizedPatient> {
    const fhirPatient = await this.fhirService.getPatient(patientId);
    return this.normalizePatient(fhirPatient);
  }

  /**
   * Get normalized practitioner information
   * @param practitionerId - Required practitioner ID
   */
  async getPractitioner(
    practitionerId: string,
  ): Promise<NormalizedPractitioner> {
    const fhirPractitioner =
      await this.fhirService.getPractitioner(practitionerId);
    return this.normalizePractitioner(fhirPractitioner);
  }

  /**
   * Get normalized observations
   * @param patientId - Required patient ID
   * @param category - Optional category filter
   */
  async getObservations(
    patientId: string,
    category?: string,
  ): Promise<NormalizedObservation[]> {
    const observations = await this.fhirService.getObservations(
      patientId,
      category,
    );
    return observations.map((obs) => this.normalizeObservation(obs));
  }

  /**
   * Get normalized conditions
   * @param patientId - Required patient ID
   */
  async getConditions(patientId: string): Promise<NormalizedCondition[]> {
    const conditions = await this.fhirService.getConditions(patientId);
    return conditions.map((cond) => this.normalizeCondition(cond));
  }

  /**
   * Get complete clinical data for a patient
   * @param patientId - Required patient ID
   */
  async getClinicalData(patientId: string): Promise<ClinicalDataResponse> {
    const [patient, observations, conditions] = await Promise.all([
      this.getPatient(patientId),
      this.getObservations(patientId),
      this.getConditions(patientId),
    ]);

    return {
      patient,
      observations,
      conditions,
    };
  }

  /**
   * Get normalized allergies
   * @param patientId - Required patient ID
   */
  async getAllergies(patientId: string): Promise<NormalizedAllergy[]> {
    const allergies = await this.fhirService.getAllergies(patientId);
    return allergies.map((allergy) => this.normalizeAllergy(allergy));
  }

  /**
   * Get normalized medications
   * @param patientId - Required patient ID
   */
  async getMedications(patientId: string): Promise<NormalizedMedication[]> {
    const medications = await this.fhirService.getMedications(patientId);
    return medications.map((med) => this.normalizeMedication(med));
  }

  /**
   * Get normalized procedures
   * @param patientId - Required patient ID
   */
  async getProcedures(patientId: string): Promise<NormalizedProcedure[]> {
    const procedures = await this.fhirService.getProcedures(patientId);
    return procedures.map((proc) => this.normalizeProcedure(proc));
  }

  /**
   * Get normalized encounters
   * @param patientId - Required patient ID
   */
  async getEncounters(patientId: string): Promise<NormalizedEncounter[]> {
    const encounters = await this.fhirService.getEncounters(patientId);
    return encounters.map((enc) => this.normalizeEncounter(enc));
  }

  /**
   * Get normalized diagnostic reports
   * @param patientId - Required patient ID
   */
  async getDiagnosticReports(
    patientId: string,
  ): Promise<NormalizedDiagnosticReport[]> {
    const diagnosticReports =
      await this.fhirService.getDiagnosticReports(patientId);
    return diagnosticReports.map((report) =>
      this.normalizeDiagnosticReport(report),
    );
  }

  /**
   * Get comprehensive diagnosis data for a patient
   * @param patientId - Required patient ID
   */
  async getDiagnosisData(patientId: string): Promise<DiagnosisDataResponse> {
    const forbiddenScopes: Record<string, 'forbidden'> = {};

    // Helper function to handle errors for array resources (403 forbidden or 404 not found)
    const handleResourceError = (
      error: unknown,
      scope: string,
      resourceName: string,
    ): [] => {
      // Handle forbidden scope errors (403)
      if (error instanceof ForbiddenScopeException) {
        const scopeName = error.scope;
        forbiddenScopes[scopeName] = 'forbidden';
        this.logger.warn(
          `Scope ${scopeName} is forbidden. ${resourceName} data will be empty.`,
        );
        return [];
      }

      // Handle 404 errors (resource not found) - return empty array
      if (error instanceof BadRequestException) {
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes('not found') ||
          errorMessage.includes('resource not found')
        ) {
          this.logger.warn(
            `${resourceName} not found for patient ${patientId}. Returning empty array.`,
          );
          return [];
        }
      }

      // Re-throw other errors
      throw error;
    };

    // Helper function to handle patient fetch (single object, not array)
    const handlePatientFetch = async (): Promise<NormalizedPatient> => {
      try {
        return await this.getPatient(patientId);
      } catch (error: unknown) {
        if (error instanceof ForbiddenScopeException) {
          const scopeName = error.scope;
          forbiddenScopes[scopeName] = 'forbidden';
          this.logger.warn(
            `Scope ${scopeName} is forbidden. Patient data cannot be fetched.`,
          );
          throw new BadRequestException(
            'Failed to fetch patient data. Patient resource scope is not enabled.',
          );
        }
        // Handle 404 for patient - still throw as patient is required
        if (error instanceof BadRequestException) {
          const errorMessage = error.message.toLowerCase();
          if (
            errorMessage.includes('not found') ||
            errorMessage.includes('resource not found')
          ) {
            throw new BadRequestException(
              `Patient ${patientId} not found. Please verify the patient ID is correct.`,
            );
          }
        }
        throw error;
      }
    };

    try {
      // Fetch patient first (required)
      const patient = await handlePatientFetch();

      // Fetch all other resources in parallel, handling forbidden scopes gracefully
      const [
        allergies,
        medications,
        procedures,
        encounters,
        diagnosticReports,
        observations,
        conditions,
      ] = await Promise.all([
        this.getAllergies(patientId).catch((error: unknown) => {
          return handleResourceError(
            error,
            'system/AllergyIntolerance.read',
            'Allergies',
          );
        }),
        this.getMedications(patientId).catch((error: unknown) => {
          return handleResourceError(
            error,
            'system/MedicationStatement.read',
            'Medications',
          );
        }),
        this.getProcedures(patientId).catch((error: unknown) => {
          return handleResourceError(
            error,
            'system/Procedure.read',
            'Procedures',
          );
        }),
        this.getEncounters(patientId).catch((error: unknown) => {
          return handleResourceError(
            error,
            'system/Encounter.read',
            'Encounters',
          );
        }),
        this.getDiagnosticReports(patientId).catch((error: unknown) => {
          return handleResourceError(
            error,
            'system/DiagnosticReport.read',
            'Diagnostic Reports',
          );
        }),
        this.getObservations(patientId).catch((error: unknown) => {
          return handleResourceError(
            error,
            'system/Observation.read',
            'Observations',
          );
        }),
        this.getConditions(patientId).catch((error: unknown) => {
          return handleResourceError(
            error,
            'system/Condition.read',
            'Conditions',
          );
        }),
      ]);

      const result: DiagnosisDataResponse = {
        patient,
        allergies: allergies || [],
        medications: medications || [],
        procedures: procedures || [],
        encounters: encounters || [],
        diagnosticReports: diagnosticReports || [],
        observations: observations || [],
        conditions: conditions || [],
      };

      // Add forbidden scopes if any
      if (Object.keys(forbiddenScopes).length > 0) {
        result.forbiddenScopes = forbiddenScopes;
      }

      return result;
    } catch (error: unknown) {
      // Re-throw BadRequestException as-is
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Re-throw ForbiddenScopeException as BadRequestException
      if (error instanceof ForbiddenScopeException) {
        throw new BadRequestException(error.message);
      }
      // Otherwise wrap in BadRequestException
      const errorMessage =
        this.getErrorMessage(error) || 'Failed to fetch diagnosis data';
      throw new BadRequestException(errorMessage);
    }
  }

  /**
   * Get bulk patient data
   * @param patientIds - Array of patient IDs
   */
  async getBulkPatients(patientIds: string[]): Promise<BulkPatientResponse> {
    if (!patientIds || patientIds.length === 0) {
      return { patients: [], total: 0 };
    }

    // Fetch all patients in parallel
    const patientPromises = patientIds.map((patientId) =>
      this.getPatient(patientId).catch((error) => {
        this.logger.error(
          `Failed to fetch patient ${patientId}: ${error.message}`,
        );
        return null;
      }),
    );

    const patients = await Promise.all(patientPromises);
    const validPatients = patients.filter(
      (p): p is NormalizedPatient => p !== null,
    );

    return {
      patients: validPatients,
      total: validPatients.length,
    };
  }

  /**
   * Normalize FHIR Patient to simplified format
   */
  normalizePatient(fhirPatient: FhirPatient): NormalizedPatient {
    const nameParts = fhirPatient.name?.[0];
    const firstName = nameParts?.given?.join(' ');
    const lastName = nameParts?.family;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    return {
      id: fhirPatient.id,
      name: fullName || undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      birthDate: fhirPatient.birthDate,
      gender: fhirPatient.gender,
      identifiers: fhirPatient.identifier,
    };
  }

  /**
   * Normalize FHIR Practitioner to simplified format
   */
  normalizePractitioner(
    fhirPractitioner: FhirPractitioner,
  ): NormalizedPractitioner {
    const nameParts = fhirPractitioner.name?.[0];
    const firstName = nameParts?.given?.join(' ');
    const lastName = nameParts?.family;
    const prefix = nameParts?.prefix;
    const suffix = nameParts?.suffix;
    const fullName = [
      ...(prefix || []),
      firstName,
      lastName,
      ...(suffix || []),
    ]
      .filter(Boolean)
      .join(' ');

    const identifiers = fhirPractitioner.identifier?.map((id) => ({
      system: id.system,
      value: id.value,
      type:
        id.type?.coding?.[0]?.display ||
        id.type?.coding?.[0]?.code ||
        undefined,
    }));

    const qualifications = fhirPractitioner.qualification?.map((qual) => ({
      code: qual.identifier?.[0]?.value,
      display:
        qual.code?.text ||
        qual.code?.coding?.[0]?.display ||
        qual.code?.coding?.[0]?.code ||
        undefined,
      issuer: qual.issuer?.display,
      period: qual.period
        ? {
            start: qual.period.start,
            end: qual.period.end,
          }
        : undefined,
    }));

    const languages =
      fhirPractitioner.communication?.map(
        (comm) =>
          comm.coding?.[0]?.display ||
          comm.coding?.[0]?.code ||
          '',
      ) || [];

    return {
      id: fhirPractitioner.id,
      name: fullName || nameParts?.text || undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      prefix: prefix || undefined,
      suffix: suffix || undefined,
      gender: fhirPractitioner.gender,
      birthDate: fhirPractitioner.birthDate,
      identifiers,
      telecom: fhirPractitioner.telecom,
      address: fhirPractitioner.address,
      qualifications,
      languages: languages.filter(Boolean),
    };
  }

  /**
   * Normalize FHIR Observation to simplified format
   */
  normalizeObservation(obs: FhirObservation): NormalizedObservation {
    const code = obs.code.coding?.[0]?.code || '';
    const display = obs.code.text || obs.code.coding?.[0]?.display || code;
    const category =
      obs.category?.[0]?.coding?.[0]?.code ||
      obs.category?.[0]?.coding?.[0]?.display;

    let value: string | number | undefined;
    let unit: string | undefined;

    if (obs.valueQuantity) {
      value = obs.valueQuantity.value;
      unit = obs.valueQuantity.unit || obs.valueQuantity.code;
    } else if (obs.valueString) {
      value = obs.valueString;
    } else if (obs.valueCodeableConcept) {
      value =
        obs.valueCodeableConcept.text ||
        obs.valueCodeableConcept.coding?.[0]?.display ||
        obs.valueCodeableConcept.coding?.[0]?.code;
    }

    return {
      id: obs.id,
      code,
      display,
      category,
      value,
      unit,
      date: obs.effectiveDateTime,
      status: obs.status,
    };
  }

  /**
   * Normalize FHIR Condition to simplified format
   */
  normalizeCondition(cond: FhirCondition): NormalizedCondition {
    const code = cond.code.coding?.[0]?.code || '';
    const display = cond.code.text || cond.code.coding?.[0]?.display || code;
    const category =
      cond.category?.[0]?.coding?.[0]?.code ||
      cond.category?.[0]?.coding?.[0]?.display;
    const status =
      cond.clinicalStatus?.coding?.[0]?.code ||
      cond.clinicalStatus?.coding?.[0]?.display;

    return {
      id: cond.id,
      code,
      display,
      category,
      status,
      onsetDate: cond.onsetDateTime,
      recordedDate: cond.recordedDate,
    };
  }

  /**
   * Normalize FHIR AllergyIntolerance to simplified format
   */
  normalizeAllergy(
    allergy: FhirAllergyIntolerance,
  ): NormalizedAllergy {
    const code = allergy.code.coding?.[0]?.code || '';
    const display =
      allergy.code.text || allergy.code.coding?.[0]?.display || code;
    const status =
      allergy.clinicalStatus?.coding?.[0]?.code ||
      allergy.clinicalStatus?.coding?.[0]?.display;

    return {
      id: allergy.id,
      code,
      display,
      type: allergy.type,
      category: allergy.category,
      criticality: allergy.criticality,
      status,
      recordedDate: allergy.recordedDate,
    };
  }

  /**
   * Normalize FHIR MedicationStatement to simplified format
   */
  normalizeMedication(
    med: FhirMedicationStatement,
  ): NormalizedMedication {
    const medication =
      med.medicationCodeableConcept || med.medicationReference;
    const code =
      med.medicationCodeableConcept?.coding?.[0]?.code ||
      med.medicationReference?.display ||
      '';
    const display =
      med.medicationCodeableConcept?.text ||
      med.medicationCodeableConcept?.coding?.[0]?.display ||
      med.medicationReference?.display ||
      code;

    const dosageText = med.dosage?.[0]?.text;
    const route =
      med.dosage?.[0]?.route?.coding?.[0]?.display ||
      med.dosage?.[0]?.route?.coding?.[0]?.code;

    return {
      id: med.id,
      code,
      display,
      status: med.status,
      startDate: med.effectivePeriod?.start,
      endDate: med.effectivePeriod?.end,
      dateAsserted: med.dateAsserted,
      dosage: dosageText,
      route,
    };
  }

  /**
   * Normalize FHIR Procedure to simplified format
   */
  normalizeProcedure(proc: FhirProcedure): NormalizedProcedure {
    const code = proc.code.coding?.[0]?.code || '';
    const display = proc.code.text || proc.code.coding?.[0]?.display || code;
    const category = proc.category?.coding?.[0]?.code;
    const outcome = proc.outcome?.coding?.[0]?.display || proc.outcome?.coding?.[0]?.code;
    const performedDate =
      proc.performedDateTime || proc.performedPeriod?.start;

    return {
      id: proc.id,
      code,
      display,
      status: proc.status,
      category,
      performedDate,
      outcome,
    };
  }

  /**
   * Normalize FHIR Encounter to simplified format
   */
  normalizeEncounter(enc: FhirEncounter): NormalizedEncounter {
    const type = enc.type?.[0]?.coding?.[0]?.display || enc.type?.[0]?.coding?.[0]?.code;
    const reason =
      enc.reasonCode?.[0]?.text ||
      enc.reasonCode?.[0]?.coding?.[0]?.display ||
      enc.reasonCode?.[0]?.coding?.[0]?.code;

    return {
      id: enc.id,
      status: enc.status,
      type,
      class: enc.class?.display || enc.class?.code,
      startDate: enc.period?.start,
      endDate: enc.period?.end,
      reason,
    };
  }

  /**
   * Normalize FHIR DiagnosticReport to simplified format
   */
  normalizeDiagnosticReport(
    report: FhirDiagnosticReport,
  ): NormalizedDiagnosticReport {
    const code = report.code.coding?.[0]?.code || '';
    const display = report.code.text || report.code.coding?.[0]?.display || code;
    const category = report.category?.[0]?.coding?.[0]?.display || report.category?.[0]?.coding?.[0]?.code;
    const effectiveDate =
      report.effectiveDateTime || report.effectivePeriod?.start;

    return {
      id: report.id,
      code,
      display,
      status: report.status,
      category,
      effectiveDate,
      issuedDate: report.issued,
      conclusion: report.conclusion,
    };
  }

  /**
   * Get human-readable clinical data for a patient
   * @param patientId - Required patient ID
   */
  async getHumanReadableData(
    patientId: string,
  ): Promise<HumanReadableClinicalData> {
    try {
      const diagnosisData = await this.getDiagnosisData(patientId);
      const humanReadable = this.transformToHumanReadable(diagnosisData);
      
      // Include forbidden scopes if present
      if (diagnosisData.forbiddenScopes) {
        humanReadable.forbiddenScopes = diagnosisData.forbiddenScopes;
      }
      
      return humanReadable;
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Error in getHumanReadableData for patient ${patientId}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Transform normalized clinical data to human-readable format
   */
  private transformToHumanReadable(
    data: DiagnosisDataResponse,
  ): HumanReadableClinicalData {
    const patient = this.transformPatient(data.patient);
    const observations = data.observations.map((obs) =>
      this.transformObservation(obs),
    );
    const conditions = data.conditions.map((cond) =>
      this.transformCondition(cond),
    );
    const allergies = data.allergies.map((allergy) =>
      this.transformAllergy(allergy),
    );
    const medications = data.medications.map((med) =>
      this.transformMedication(med),
    );
    const procedures = data.procedures.map((proc) =>
      this.transformProcedure(proc),
    );
    const encounters = data.encounters.map((enc) =>
      this.transformEncounter(enc),
    );
    const diagnosticReports = data.diagnosticReports.map((report) =>
      this.transformDiagnosticReport(report),
    );

    const summary = {
      totalObservations: observations.length,
      totalConditions: conditions.length,
      totalAllergies: allergies.length,
      totalMedications: medications.length,
      totalProcedures: procedures.length,
      totalEncounters: encounters.length,
      totalReports: diagnosticReports.length,
    };

    const narrative = this.generateNarrative(
      patient,
      summary,
      conditions,
      allergies,
      medications,
    );

    return {
      patient,
      summary,
      observations,
      conditions,
      allergies,
      medications,
      procedures,
      encounters,
      diagnosticReports,
      narrative,
    };
  }

  /**
   * Transform patient data to human-readable format
   */
  private transformPatient(patient: NormalizedPatient): HumanReadablePatient {
    const name = patient.name || 'Unknown Patient';
    const age = patient.birthDate
      ? this.calculateAge(patient.birthDate)
      : undefined;
    const gender = patient.gender
      ? this.capitalizeFirst(patient.gender)
      : undefined;
    const dateOfBirth = patient.birthDate
      ? this.formatDate(patient.birthDate)
      : undefined;
    const identifiers = patient.identifiers
      ? patient.identifiers.map(
          (id) => `${id.value || ''}${id.system ? ` (${this.getIdentifierType(id.system)})` : ''}`,
        )
      : undefined;

    return {
      name,
      age,
      gender,
      dateOfBirth,
      identifiers,
    };
  }

  /**
   * Transform observation to human-readable format
   */
  private transformObservation(
    obs: NormalizedObservation,
  ): HumanReadableObservation {
    const testName = obs.display || obs.code;
    const value = this.formatObservationValue(obs.value, obs.unit);
    const date = obs.date ? this.formatDate(obs.date) : 'Date not available';
    const status = this.capitalizeFirst(obs.status);

    return {
      testName,
      value,
      date,
      status,
    };
  }

  /**
   * Transform condition to human-readable format
   */
  private transformCondition(
    cond: NormalizedCondition,
  ): HumanReadableCondition {
    const diagnosis = cond.display || cond.code;
    const status = this.formatStatus(cond.status || 'unknown');
    const onsetDate = cond.onsetDate ? this.formatDate(cond.onsetDate) : undefined;
    const recordedDate = cond.recordedDate
      ? this.formatDate(cond.recordedDate)
      : undefined;

    return {
      diagnosis,
      status,
      onsetDate,
      recordedDate,
    };
  }

  /**
   * Transform allergy to human-readable format
   */
  private transformAllergy(allergy: NormalizedAllergy): HumanReadableAllergy {
    const allergen = allergy.display || allergy.code;
    const type = allergy.type ? this.capitalizeFirst(allergy.type) : 'Unknown';
    const severity = allergy.criticality
      ? this.formatCriticality(allergy.criticality)
      : undefined;
    const status = this.formatStatus(allergy.status || 'unknown');
    const recordedDate = allergy.recordedDate
      ? this.formatDate(allergy.recordedDate)
      : undefined;

    return {
      allergen,
      type,
      severity,
      status,
      recordedDate,
    };
  }

  /**
   * Transform medication to human-readable format
   */
  private transformMedication(
    med: NormalizedMedication,
  ): HumanReadableMedication {
    const medication = med.display || med.code;
    const status = this.formatStatus(med.status);
    const dosage = med.dosage;
    const route = med.route ? this.capitalizeFirst(med.route) : undefined;
    const startDate = med.startDate ? this.formatDate(med.startDate) : undefined;
    const endDate = med.endDate ? this.formatDate(med.endDate) : undefined;

    return {
      medication,
      status,
      dosage,
      route,
      startDate,
      endDate,
    };
  }

  /**
   * Transform procedure to human-readable format
   */
  private transformProcedure(
    proc: NormalizedProcedure,
  ): HumanReadableProcedure {
    const procedure = proc.display || proc.code;
    const status = this.formatStatus(proc.status);
    const date = proc.performedDate
      ? this.formatDate(proc.performedDate)
      : undefined;
    const outcome = proc.outcome
      ? this.capitalizeFirst(proc.outcome)
      : undefined;

    return {
      procedure,
      status,
      date,
      outcome,
    };
  }

  /**
   * Transform encounter to human-readable format
   */
  private transformEncounter(enc: NormalizedEncounter): HumanReadableEncounter {
    const visitType = enc.type || enc.class || 'Unknown Visit Type';
    const reason = enc.reason;
    const startDate = enc.startDate ? this.formatDate(enc.startDate) : undefined;
    const endDate = enc.endDate ? this.formatDate(enc.endDate) : undefined;
    const status = this.formatStatus(enc.status);

    return {
      visitType,
      reason,
      startDate,
      endDate,
      status,
    };
  }

  /**
   * Transform diagnostic report to human-readable format
   */
  private transformDiagnosticReport(
    report: NormalizedDiagnosticReport,
  ): HumanReadableDiagnosticReport {
    const reportName = report.display || report.code;
    const status = this.formatStatus(report.status);
    const date = report.effectiveDate
      ? this.formatDate(report.effectiveDate)
      : report.issuedDate
        ? this.formatDate(report.issuedDate)
        : undefined;
    const conclusion = report.conclusion;

    return {
      reportName,
      status,
      date,
      conclusion,
    };
  }

  /**
   * Format date to human-readable format (e.g., "January 15, 2020")
   */
  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString; // Return original if invalid
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Format observation value with unit
   */
  private formatObservationValue(
    value: string | number | undefined,
    unit: string | undefined,
  ): string {
    if (value === undefined || value === null) {
      return 'Value not available';
    }
    const formattedValue = typeof value === 'number' ? value.toString() : value;
    return unit ? `${formattedValue} ${unit}` : formattedValue;
  }

  /**
   * Capitalize first letter of a string
   */
  private capitalizeFirst(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Format status to human-readable format
   */
  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      active: 'Active',
      inactive: 'Inactive',
      resolved: 'Resolved',
      completed: 'Completed',
      cancelled: 'Cancelled',
      entered_in_error: 'Entered in Error',
      final: 'Final',
      preliminary: 'Preliminary',
      registered: 'Registered',
      finished: 'Finished',
      planned: 'Planned',
      in_progress: 'In Progress',
      on_hold: 'On Hold',
      stopped: 'Stopped',
      unknown: 'Unknown',
    };

    return statusMap[status.toLowerCase()] || this.capitalizeFirst(status);
  }

  /**
   * Format criticality to human-readable format
   */
  private formatCriticality(criticality: string): string {
    const criticalityMap: Record<string, string> = {
      low: 'Low',
      high: 'High',
      'unable-to-assess': 'Unable to Assess',
    };

    return (
      criticalityMap[criticality.toLowerCase()] ||
      this.capitalizeFirst(criticality)
    );
  }

  /**
   * Calculate age from birth date
   */
  private calculateAge(birthDate: string): string {
    try {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birth.getDate())
      ) {
        age--;
      }
      return `${age} years old`;
    } catch {
      return 'Age not available';
    }
  }

  /**
   * Get identifier type from system URL
   */
  private getIdentifierType(system: string): string {
    if (system.includes('mrn')) return 'MRN';
    if (system.includes('ssn')) return 'SSN';
    if (system.includes('passport')) return 'Passport';
    if (system.includes('driver')) return "Driver's License";
    return 'ID';
  }

  /**
   * Generate narrative summary of patient data
   */
  private generateNarrative(
    patient: HumanReadablePatient,
    summary: {
      totalObservations: number;
      totalConditions: number;
      totalAllergies: number;
      totalMedications: number;
    },
    conditions: HumanReadableCondition[],
    allergies: HumanReadableAllergy[],
    medications: HumanReadableMedication[],
  ): string {
    const parts: string[] = [];

    parts.push(
      `Patient Summary for ${patient.name}${patient.age ? `, ${patient.age}` : ''}${patient.gender ? ` (${patient.gender})` : ''}.`,
    );

    if (summary.totalConditions > 0) {
      const activeConditions = conditions.filter(
        (c) => c.status.toLowerCase() === 'active',
      );
      if (activeConditions.length > 0) {
        parts.push(
          `Active conditions: ${activeConditions.map((c) => c.diagnosis).join(', ')}.`,
        );
      }
    }

    if (summary.totalAllergies > 0) {
      const activeAllergies = allergies.filter(
        (a) => a.status.toLowerCase() === 'active',
      );
      if (activeAllergies.length > 0) {
        parts.push(
          `Known allergies: ${activeAllergies.map((a) => a.allergen).join(', ')}.`,
        );
      }
    }

    if (summary.totalMedications > 0) {
      const activeMeds = medications.filter(
        (m) => m.status.toLowerCase() === 'active',
      );
      if (activeMeds.length > 0) {
        parts.push(
          `Current medications: ${activeMeds.map((m) => m.medication).join(', ')}.`,
        );
      }
    }

    parts.push(
      `Total records: ${summary.totalObservations} observations, ${summary.totalConditions} conditions, ${summary.totalAllergies} allergies, ${summary.totalMedications} medications.`,
    );

    return parts.join(' ');
  }
}
