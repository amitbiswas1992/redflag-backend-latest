import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Entity Normalizer
 * Converts flat FHIR CSV rows into normalized entity objects for database persistence.
 * Uses deterministic natural keys (epicId) for idempotent upserts.
 *
 * Supports 8 entity types:
 * 1. Patient (from patient_* columns)
 * 2. Practitioner (from practitioner_* columns)
 * 3. Encounter (from encounter_* columns)
 * 4. Observation (from observation_* columns)
 * 5. Condition (from condition_* columns)
 * 6. Medication (from medication_* columns)
 * 7. Allergy (from allergy_* columns)
 * 8. Procedure (from procedure_* columns)
 * 9. DiagnosticReport (from diagnostic_report_* columns)
 */

export interface NormalizedEntities {
    patient?: Prisma.PatientCreateInput;
    practitioner?: Prisma.PractitionerCreateInput;
    encounter?: Omit<Prisma.EncounterCreateInput, 'patient'>;
    observation?: Omit<Prisma.ObservationCreateInput, 'patient'>;
    condition?: Omit<Prisma.ConditionCreateInput, 'patient'>;
    medication?: Omit<Prisma.MedicationCreateInput, 'patient'>;
    allergy?: Omit<Prisma.AllergyCreateInput, 'patient'>;
    procedure?: Omit<Prisma.ProcedureCreateInput, 'patient'>;
    diagnosticReport?: Omit<Prisma.DiagnosticReportCreateInput, 'patient'>;
}

export interface EntityNormalizationResult {
    success: boolean;
    entities?: NormalizedEntities;
    errors?: string[];
}

const logger = new Logger('EntityNormalizer');

/**
 * Normalize a flat FHIR CSV row into structured entity objects
 * @param row Flat FHIR CSV row (snake_case keys after header normalization)
 * @returns NormalizedEntities or error result
 */
export function normalizeRowToEntities(
    row: Record<string, any>,
): EntityNormalizationResult {
    const errors: string[] = [];
    const entities: NormalizedEntities = {};

    try {
        // Extract Patient
        if (row.patient_epic_id) {
            entities.patient = extractPatient(row);
        } else {
            errors.push('Missing required field: patient_epic_id');
        }

        // Extract Practitioner (optional)
        if (row.practitioner_epic_id) {
            entities.practitioner = extractPractitioner(row);
        }

        // Extract Encounter (optional)
        if (row.encounter_epic_id) {
            entities.encounter = extractEncounter(row);
        }

        // Extract Observation (optional)
        if (row.observation_epic_id) {
            entities.observation = extractObservation(row);
        }

        // Extract Condition (optional)
        if (row.condition_epic_id) {
            entities.condition = extractCondition(row);
        }

        // Extract Medication (optional)
        if (row.medication_epic_id) {
            entities.medication = extractMedication(row);
        }

        // Extract Allergy (optional)
        if (row.allergy_epic_id) {
            entities.allergy = extractAllergy(row);
        }

        // Extract Procedure (optional)
        if (row.procedure_epic_id) {
            entities.procedure = extractProcedure(row);
        }

        // Extract DiagnosticReport (optional)
        if (row.diagnostic_report_epic_id) {
            entities.diagnosticReport = extractDiagnosticReport(row);
        }

        if (errors.length > 0) {
            return { success: false, errors };
        }

        return { success: true, entities };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Entity normalization failed: ${message}`);
        return { success: false, errors };
    }
}

/**
 * Extract and normalize Patient entity
 */
function extractPatient(row: Record<string, any>): Prisma.PatientCreateInput {
    return {
        epicId: row.patient_epic_id,
        name: row.patient_name || null,
        firstName: row.patient_first_name || null,
        lastName: row.patient_last_name || null,
        birthDate: parseDate(row.patient_birth_date),
        gender: row.patient_gender || null,
        identifiers: row.patient_identifier_system
            ? ([
                {
                    system: row.patient_identifier_system,
                    value: row.patient_identifier_value,
                },
            ] as unknown as Prisma.InputJsonValue)
            : (null as any),
    };
}

/**
 * Extract and normalize Practitioner entity
 */
function extractPractitioner(
    row: Record<string, any>,
): Prisma.PractitionerCreateInput {
    return {
        epicId: row.practitioner_epic_id,
        name: row.practitioner_name || null,
        prefix: [],
        suffix: [],
        languages: [],
    };
}

/**
 * Extract and normalize Encounter entity
 * Note: patientId must be provided and connected via the service layer
 */
function extractEncounter(
    row: Record<string, any>,
): Omit<Prisma.EncounterCreateInput, 'patient'> {
    return {
        epicId: row.encounter_epic_id,
        visitType: row.encounter_status || null,
        reason: null,
        startDate: parseDate(row.encounter_start_date),
        endDate: parseDate(row.encounter_end_date),
        status: row.encounter_status || null,
        type: null,
        class: null,
    };
}

/**
 * Extract and normalize Observation entity
 * Note: patientId must be provided and connected via the service layer
 */
function extractObservation(
    row: Record<string, any>,
): Omit<Prisma.ObservationCreateInput, 'patient'> {
    return {
        epicId: row.observation_epic_id,
        testName: row.observation_test_name || null,
        value: row.observation_value || null,
        date: parseDate(row.observation_date),
        status: 'final',
        code: row.observation_code || null,
        display: row.observation_test_name || null,
        category: 'vital-signs',
        unit: row.observation_unit || null,
    };
}

/**
 * Extract and normalize Condition entity
 * Note: patientId must be provided and connected via the service layer
 */
function extractCondition(
    row: Record<string, any>,
): Omit<Prisma.ConditionCreateInput, 'patient'> {
    return {
        epicId: row.condition_epic_id,
        diagnosis: row.condition_diagnosis || null,
        status: row.condition_status || null,
        onsetDate: parseDate(row.condition_onset_date),
        recordedDate: new Date(),
        code: null,
        display: row.condition_diagnosis || null,
        category: null,
    };
}

/**
 * Extract and normalize Medication entity
 * Note: patientId must be provided and connected via the service layer
 */
function extractMedication(
    row: Record<string, any>,
): Omit<Prisma.MedicationCreateInput, 'patient'> {
    return {
        epicId: row.medication_epic_id,
        medication: row.medication_name || null,
        status: row.medication_status || null,
        dosage: row.medication_dosage || null,
        route: row.medication_route || null,
        startDate: null,
        endDate: null,
        dateAsserted: new Date(),
        code: null,
        display: row.medication_name || null,
    };
}

/**
 * Extract and normalize Allergy entity
 * Note: patientId must be provided and connected via the service layer
 */
function extractAllergy(
    row: Record<string, any>,
): Omit<Prisma.AllergyCreateInput, 'patient'> {
    return {
        epicId: row.allergy_epic_id,
        allergen: row.allergy_allergen || null,
        type: row.allergy_type || null,
        severity: null,
        status: row.allergy_status || null,
        recordedDate: new Date(),
        code: null,
        display: row.allergy_allergen || null,
        category: [],
        criticality: row.allergy_criticality || null,
    };
}

/**
 * Extract and normalize Procedure entity
 * Note: patientId must be provided and connected via the service layer
 */
function extractProcedure(
    row: Record<string, any>,
): Omit<Prisma.ProcedureCreateInput, 'patient'> {
    return {
        epicId: row.procedure_epic_id,
        procedure: row.procedure_name || null,
        status: row.procedure_status || null,
        date: parseDate(row.procedure_performed_date),
        outcome: null,
        code: null,
        display: row.procedure_name || null,
        category: null,
        performedDate: parseDate(row.procedure_performed_date),
    };
}

/**
 * Extract and normalize DiagnosticReport entity
 * Note: patientId must be provided and connected via the service layer
 */
function extractDiagnosticReport(
    row: Record<string, any>,
): Omit<Prisma.DiagnosticReportCreateInput, 'patient'> {
    return {
        epicId: row.diagnostic_report_epic_id,
        reportName: row.diagnostic_report_name || null,
        status: row.diagnostic_report_status || null,
        date: parseDate(row.diagnostic_report_date),
        conclusion: null,
        code: null,
        display: row.diagnostic_report_name || null,
        category: null,
        effectiveDate: parseDate(row.diagnostic_report_date),
        issuedDate: parseDate(row.diagnostic_report_date),
    };
}

/**
 * Parse ISO date string to DateTime or null
 */
function parseDate(value: any): Date | null {
    if (!value) return null;
    try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return null;
        return date;
    } catch {
        return null;
    }
}
