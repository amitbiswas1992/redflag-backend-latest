import { pgTable, text, timestamp, uuid, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './identity';

export const patients = pgTable('patients', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    sourceId: text('source_id').notNull(), // Epic/Cerner or row ID
    identifier: jsonb('identifier'), // Array of identifiers
    name: jsonb('name'), // Array of names
    telecom: jsonb('telecom'), // Array of contacts
    gender: text('gender'),
    birthDate: timestamp('birth_date'),
    address: jsonb('address'), // Array of addresses
    communication: jsonb('communication'),
    extension: jsonb('extension'), // Custom fields like Race, Ethnicity
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('unq_source_org_patient').on(table.organizationId, table.sourceId)
]);

export const practitioners = pgTable('practitioners', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    sourceId: text('source_id').notNull(),
    identifier: jsonb('identifier'),
    name: jsonb('name'),
    telecom: jsonb('telecom'),
    address: jsonb('address'),
    gender: text('gender'),
    birthDate: timestamp('birth_date'),
    qualification: jsonb('qualification'),
    communication: jsonb('communication'),
    extension: jsonb('extension'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('unq_source_org_practitioner').on(table.organizationId, table.sourceId)
]);

export const encounters = pgTable('encounters', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    sourceId: text('source_id').notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    status: text('status'), // planned, arrived, in-progress, finished
    class: jsonb('class'), // Coding object
    type: jsonb('type'), // Array of CodeableConcepts
    participant: jsonb('participant'), // Array of practitioners/roles
    period: jsonb('period'), // {start, end}
    location: jsonb('location'), // Array of locations
    serviceProvider: text('service_provider'), // Organization reference
    extension: jsonb('extension'), // Telehealth custom fields mapped here originally
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('unq_source_org_encounter').on(table.organizationId, table.sourceId)
]);

export const medications = pgTable('medications', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    sourceId: text('source_id').notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    status: text('status'),
    intent: text('intent'),
    medicationCodeableConcept: jsonb('medication_codeable_concept'),
    dosageInstruction: jsonb('dosage_instruction'),
    dispenseRequest: jsonb('dispense_request'),
    extension: jsonb('extension'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('unq_source_org_medication').on(table.organizationId, table.sourceId)
]);

export const conditions = pgTable('conditions', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    sourceId: text('source_id').notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    clinicalStatus: jsonb('clinical_status'),
    verificationStatus: jsonb('verification_status'),
    category: jsonb('category'), // array of codeable concepts
    code: jsonb('code'), // codeable concept
    onsetDateTime: timestamp('onset_date_time'),
    recordedDate: timestamp('recorded_date'),
    extension: jsonb('extension'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('unq_source_org_condition').on(table.organizationId, table.sourceId)
]);

export const observations = pgTable('observations', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    sourceId: text('source_id').notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    status: text('status'),
    category: jsonb('category'),
    code: jsonb('code'),
    effectiveDateTime: timestamp('effective_date_time'),
    valueQuantity: jsonb('value_quantity'),
    valueCodeableConcept: jsonb('value_codeable_concept'),
    valueString: text('value_string'),
    extension: jsonb('extension'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('unq_source_org_observation').on(table.organizationId, table.sourceId)
]);

// Supporting additional clinical models requested
export const allergies = pgTable('allergies', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    sourceId: text('source_id').notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    clinicalStatus: jsonb('clinical_status'),
    verificationStatus: jsonb('verification_status'),
    type: text('type'),
    category: jsonb('category'),
    criticality: text('criticality'),
    code: jsonb('code'), // the allergen codeable concept
    reaction: jsonb('reaction'),
    recordedDate: timestamp('recorded_date'),
    extension: jsonb('extension'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('unq_source_org_allergy').on(table.organizationId, table.sourceId)
]);

export const procedures = pgTable('procedures', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    sourceId: text('source_id').notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    status: text('status'),
    statusReason: jsonb('status_reason'),
    category: jsonb('category'),
    code: jsonb('code'),
    performedDateTime: timestamp('performed_date_time'),
    outcome: jsonb('outcome'),
    extension: jsonb('extension'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('unq_source_org_procedure').on(table.organizationId, table.sourceId)
]);

export const diagnosticReports = pgTable('diagnostic_reports', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    sourceId: text('source_id').notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    status: text('status'),
    category: jsonb('category'),
    code: jsonb('code'),
    effectiveDateTime: timestamp('effective_date_time'),
    issued: timestamp('issued'),
    conclusion: text('conclusion'),
    conclusionCode: jsonb('conclusion_code'),
    extension: jsonb('extension'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('unq_source_org_diagnostic_report').on(table.organizationId, table.sourceId)
]);
