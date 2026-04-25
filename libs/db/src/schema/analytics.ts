import {
    boolean,
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from 'drizzle-orm/pg-core';
import { encounters, medications } from './clinical';
import { organizations } from './identity';

export const encounterAnalytics = pgTable('encounter_analytics', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    encounterId: uuid('encounter_id').references(() => encounters.id, { onDelete: 'cascade' }).notNull(),

    // Extracted Analytics Layer
    isTelehealth: boolean('is_telehealth'),
    encounterType: text('encounter_type'),
    sessionDuration: integer('session_duration'),
    chiefComplaint: text('chief_complaint'),
    primaryDiagnosis: text('primary_diagnosis'),
    vitalSignsRecorded: boolean('vital_signs_recorded'),
    crossStateFlag: boolean('cross_state_flag'),
    crossStateLicense: boolean('cross_state_license'),
    hipaaPlatformValidated: boolean('hipaa_platform_validated'),
    consentObtained: boolean('consent_obtained'),
    informedConsentType: text('informed_consent_type'),
    durationMinutes: integer('duration_minutes'),
    clinicalNotesCompleted: boolean('clinical_notes_completed'),
    noteSignedDate: text('note_signed_date'),
    documentationComplete: boolean('documentation_complete'),
    mentalHealthScreening: boolean('mental_health_screening'),
    substanceUseScreening: boolean('substance_use_screening'),
    allergiesReviewed: boolean('allergies_reviewed'),
    coordinationWithPcp: boolean('coordination_with_pcp'),
    followUpScheduled: boolean('follow_up_scheduled'),
    carePlanUpdated: boolean('care_plan_updated'),
    clinicalProtocolApprovedBy: text('clinical_protocol_approved_by'),
    corporateStructure: text('corporate_structure'),
    physicianOwnershipPercentage: integer('physician_ownership_percentage'),
    clinicalDecisionMaker: text('clinical_decision_maker'),
    clinicalDecisionSupport: boolean('clinical_decision_support'),
    cdsAlertCount: integer('cds_alert_count'),
    technologyAssessment: boolean('technology_assessment'),
    patientIdentityVerified: boolean('patient_identity_verified'),
    sessionRecordingConsent: boolean('session_recording_consent'),
    telehealthId: text('telehealth_id'),
    providerName: text('provider_name'),
    qualityMeasureMet: boolean('quality_measure_met'),
    overrideReason: text('override_reason'),
    controlledSubstancePrescribed: boolean('controlled_substance_prescribed'),
    medicationPrescribed: text('medication_prescribed'),
    prescriberDea: text('prescriber_dea'),
    autoRefillPolicyCorporateMandated: boolean(
        'auto_refill_policy_corporate_mandated',
    ),
    providerLocationState: text('provider_location_state'),
    patientLocationState: text('patient_location_state'),
    stateLicensureVerified: boolean('state_licensure_verified'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('unq_encounter_analytics').on(table.encounterId),
    index('idx_encounter_analytics_org').on(table.organizationId),
    index('idx_encounter_analytics_rule_hot_path').on(
        table.isTelehealth,
        table.documentationComplete,
        table.crossStateFlag,
    ),
]);

export const medicationAnalytics = pgTable('medication_analytics', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    medicationId: uuid('medication_id').references(() => medications.id, { onDelete: 'cascade' }).notNull(),

    // Extracted Analytics Layer
    controlledSubstance: boolean('controlled_substance'),
    controlledSubstancePrescribed: boolean('controlled_substance_prescribed'),
    deaSchedule: text('dea_schedule'),
    refillCount: integer('refill_count'),
    autoRefillEnabled: boolean('auto_refill_enabled'),
    autoRefillPolicyCorporateMandated: boolean(
        'auto_refill_policy_corporate_mandated',
    ),
    medicationPrescribed: text('medication_prescribed'),
    medicationAdherence: text('medication_adherence'),
    prescriberDea: text('prescriber_dea'),
    followUpScheduled: boolean('follow_up_scheduled'),
    carePlanUpdated: boolean('care_plan_updated'),
    vitalSignsRecorded: boolean('vital_signs_recorded'),
    coordinationWithPcp: boolean('coordination_with_pcp'),
    clinicalDecisionSupport: boolean('clinical_decision_support'),
    cdsAlertCount: integer('cds_alert_count'),
    overrideReason: text('override_reason'),
    substanceCode: text('substance_code'),
    substanceQuantity: integer('substance_quantity'),
    substanceExpiry: text('substance_expiry'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('unq_medication_analytics').on(table.medicationId),
    index('idx_medication_analytics_org').on(table.organizationId),
    index('idx_medication_analytics_rule_hot_path').on(
        table.controlledSubstance,
        table.deaSchedule,
    ),
]);
