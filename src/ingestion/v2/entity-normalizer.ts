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

function pickFirst(row: Record<string, any>, ...keys: string[]): string | undefined {
    for (const key of keys) {
        const value = row[key];
        if (value === undefined || value === null) {
            continue;
        }

        const text = String(value).trim();
        if (text.length > 0) {
            return text;
        }
    }

    return undefined;
}

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
        const patientEpicId = pickFirst(row, 'patient_epic_id', 'patient_id');
        const practitionerEpicId = pickFirst(row, 'practitioner_epic_id', 'practitioner_id');
        const encounterEpicId = pickFirst(row, 'encounter_epic_id', 'encounter_id');
        const observationEpicId = pickFirst(row, 'observation_epic_id', 'observation_id');
        const conditionEpicId = pickFirst(row, 'condition_epic_id', 'condition_id');
        const medicationEpicId = pickFirst(row, 'medication_epic_id', 'medication_request_id');
        const allergyEpicId = pickFirst(row, 'allergy_epic_id', 'allergy_id');
        const procedureEpicId = pickFirst(row, 'procedure_epic_id', 'procedure_id');
        const diagnosticReportEpicId = pickFirst(
            row,
            'diagnostic_report_epic_id',
            'diagnostic_report_id',
        );

        // Extract Patient
        if (patientEpicId) {
            entities.patient = extractPatient(row);
        } else {
            errors.push('Missing required field: patient_epic_id or patient_id');
        }

        // Extract Practitioner (optional)
        if (practitionerEpicId) {
            entities.practitioner = extractPractitioner(row);
        }

        // Extract Encounter (optional)
        if (encounterEpicId) {
            entities.encounter = extractEncounter(row);
        }

        // Extract Observation (optional)
        if (observationEpicId) {
            entities.observation = extractObservation(row);
        }

        // Extract Condition (optional)
        if (conditionEpicId) {
            entities.condition = extractCondition(row);
        }

        // Extract Medication (optional)
        if (medicationEpicId) {
            entities.medication = extractMedication(row);
        }

        // Extract Allergy (optional)
        if (allergyEpicId) {
            entities.allergy = extractAllergy(row);
        }

        // Extract Procedure (optional)
        if (procedureEpicId) {
            entities.procedure = extractProcedure(row);
        }

        // Extract DiagnosticReport (optional)
        if (diagnosticReportEpicId) {
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
    const firstName = pickFirst(row, 'patient_first_name', 'given_name');
    const lastName = pickFirst(row, 'patient_last_name', 'family_name');
    const fallbackName = [firstName, lastName].filter(Boolean).join(' ');
    const fullName = pickFirst(row, 'patient_name') ?? (fallbackName || null);

    return {
        epicId: pickFirst(row, 'patient_epic_id', 'patient_id')!,
        name: fullName,
        firstName: firstName || null,
        lastName: lastName || null,
        birthDate: parseDate(pickFirst(row, 'patient_birth_date', 'birth_date', 'date_of_birth')),
        gender: pickFirst(row, 'patient_gender', 'gender') || null,
        identifiers: pickFirst(row, 'patient_identifier_system')
            ? ([
                {
                    system: pickFirst(row, 'patient_identifier_system'),
                    value: pickFirst(row, 'patient_identifier_value'),
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
        epicId: pickFirst(row, 'practitioner_epic_id', 'practitioner_id', 'practitioner_name')!,
        name: pickFirst(row, 'practitioner_name', 'provider_name') || null,
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
        epicId: pickFirst(row, 'encounter_epic_id', 'encounter_id')!,
        visitType: pickFirst(row, 'encounter_status', 'encounter_type') || null,
        reason: null,
        startDate: parseDate(pickFirst(row, 'encounter_start_date', 'session_start_time', 'start_date')),
        endDate: parseDate(pickFirst(row, 'encounter_end_date', 'session_end_time', 'end_date')),
        status: pickFirst(row, 'encounter_status') || null,
        type: pickFirst(row, 'encounter_type') || null,
        class: pickFirst(row, 'encounter_class_code', 'encounter_class_display') || null,
    };
}

/**
 * Extract and normalize Observation entity
 * Note: patientId must be provided and connected via the service layer
 */
function extractObservation(
    row: Record<string, any>,
): Omit<Prisma.ObservationCreateInput, 'patient'> {
    const testName = pickFirst(row, 'observation_test_name', 'observation_name');

    return {
        epicId: pickFirst(row, 'observation_epic_id', 'observation_id')!,
        testName: testName || null,
        value: pickFirst(row, 'observation_value') || null,
        date: parseDate(row.observation_date),
        status: 'final',
        code: pickFirst(row, 'observation_code') || null,
        display: testName || null,
        category: 'vital-signs',
        unit: pickFirst(row, 'observation_unit') || null,
    };
}

/**
 * Extract and normalize Condition entity
 * Note: patientId must be provided and connected via the service layer
 */
function extractCondition(
    row: Record<string, any>,
): Omit<Prisma.ConditionCreateInput, 'patient'> {
    const diagnosis = pickFirst(row, 'condition_diagnosis', 'condition_display', 'primary_diagnosis');

    return {
        epicId: pickFirst(row, 'condition_epic_id', 'condition_id')!,
        diagnosis: diagnosis || null,
        status: pickFirst(row, 'condition_status', 'clinical_status') || null,
        onsetDate: parseDate(pickFirst(row, 'condition_onset_date', 'onset_date')),
        recordedDate: new Date(),
        code: pickFirst(row, 'condition_code') || null,
        display: diagnosis || null,
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
    const medicationName = pickFirst(row, 'medication_name', 'medication_prescribed');

    return {
        epicId: pickFirst(row, 'medication_epic_id', 'medication_request_id')!,
        medication: medicationName || null,
        status: pickFirst(row, 'medication_status') || null,
        dosage: pickFirst(row, 'medication_dosage') || null,
        route: pickFirst(row, 'medication_route') || null,
        startDate: null,
        endDate: null,
        dateAsserted: new Date(),
        code: pickFirst(row, 'medication_code') || null,
        display: medicationName || null,
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
