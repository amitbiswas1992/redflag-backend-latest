import { Injectable, Logger } from '@nestjs/common';
import { FhirService } from '../fhir/fhir.service';
import {
  NormalizedPatient,
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
} from './interfaces/clinical.interface';
import {
  FhirPatient,
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
   * Get normalized patient information
   * @param patientId - Required patient ID
   */
  async getPatient(patientId: string): Promise<NormalizedPatient> {
    const fhirPatient = await this.fhirService.getPatient(patientId);
    return this.normalizePatient(fhirPatient);
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
    const [
      patient,
      allergies,
      medications,
      procedures,
      encounters,
      diagnosticReports,
      observations,
      conditions,
    ] = await Promise.all([
      this.getPatient(patientId),
      this.getAllergies(patientId),
      this.getMedications(patientId),
      this.getProcedures(patientId),
      this.getEncounters(patientId),
      this.getDiagnosticReports(patientId),
      this.getObservations(patientId),
      this.getConditions(patientId),
    ]);

    return {
      patient,
      allergies,
      medications,
      procedures,
      encounters,
      diagnosticReports,
      observations,
      conditions,
    };
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
  private normalizePatient(fhirPatient: FhirPatient): NormalizedPatient {
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
   * Normalize FHIR Observation to simplified format
   */
  private normalizeObservation(obs: FhirObservation): NormalizedObservation {
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
  private normalizeCondition(cond: FhirCondition): NormalizedCondition {
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
  private normalizeAllergy(
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
  private normalizeMedication(
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
  private normalizeProcedure(proc: FhirProcedure): NormalizedProcedure {
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
  private normalizeEncounter(enc: FhirEncounter): NormalizedEncounter {
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
  private normalizeDiagnosticReport(
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
}
