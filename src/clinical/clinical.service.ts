import { Injectable, Logger } from '@nestjs/common';
import { FhirService } from '../fhir/fhir.service';
import {
  NormalizedPatient,
  NormalizedObservation,
  NormalizedCondition,
  ClinicalDataResponse,
} from './interfaces/clinical.interface';
import {
  FhirPatient,
  FhirObservation,
  FhirCondition,
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
}
