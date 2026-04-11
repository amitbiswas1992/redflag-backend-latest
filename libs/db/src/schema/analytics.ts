import { pgTable, text, timestamp, uuid, boolean, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './identity';
import { encounters, medications } from './clinical';

export const encounterAnalytics = pgTable('encounter_analytics', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    encounterId: uuid('encounter_id').references(() => encounters.id, { onDelete: 'cascade' }).notNull(),

    // Extracted Analytics Layer
    isTelehealth: boolean('is_telehealth'),
    crossStateFlag: boolean('cross_state_flag'),
    hipaaPlatformValidated: boolean('hipaa_platform_validated'),
    durationMinutes: integer('duration_minutes'),
    documentationComplete: boolean('documentation_complete'),
    patientIdentityVerified: boolean('patient_identity_verified'),
    sessionRecordingConsent: boolean('session_recording_consent'),
    providerLocationState: text('provider_location_state'),
    patientLocationState: text('patient_location_state'),
    stateLicensureVerified: boolean('state_licensure_verified'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('unq_encounter_analytics').on(table.encounterId)
]);

export const medicationAnalytics = pgTable('medication_analytics', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    medicationId: uuid('medication_id').references(() => medications.id, { onDelete: 'cascade' }).notNull(),

    // Extracted Analytics Layer
    controlledSubstance: boolean('controlled_substance'),
    deaSchedule: text('dea_schedule'),
    refillCount: integer('refill_count'),
    autoRefillEnabled: boolean('auto_refill_enabled'),
    medicationAdherence: text('medication_adherence'),
    prescriberDea: text('prescriber_dea'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('unq_medication_analytics').on(table.medicationId)
]);
