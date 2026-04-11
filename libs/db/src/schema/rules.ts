import { pgTable, text, timestamp, uuid, boolean, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './identity';
import { patients } from './clinical';

export const riskRules = pgTable('risk_rules', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(), // Allow custom rules per tenant
    roleName: text('role_name').notNull(),
    ruleCode: text('rule_code'),
    riskLevel: text('risk_level').notNull(),
    eventName: text('event_name'),
    score: integer('score').notNull(),
    conditionLogic: text('condition_logic').default('AND').notNull(),
    affectedVariables: jsonb('affected_variables'),
    taxonomy: text('taxonomy'),
    regulatoryCitation: text('regulatory_citation'),
    redFlags: jsonb('red_flags'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ruleConditions = pgTable('rule_conditions', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    ruleId: uuid('rule_id').references(() => riskRules.id, { onDelete: 'cascade' }).notNull(),
    field: text('field').notNull(),
    operator: text('operator').notNull(),
    value: text('value'),
    order: integer('order').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const riskEvaluations = pgTable('risk_evaluations', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    ruleId: uuid('rule_id').references(() => riskRules.id, { onDelete: 'cascade' }).notNull(),
    matched: boolean('matched').notNull(),
    matchedValue: text('matched_value'),
    score: integer('score').notNull(),
    evaluatedAt: timestamp('evaluated_at').defaultNow().notNull(),
    eventType: text('event_type').notNull(),
    eventId: uuid('event_id'),
}, (table) => [
    uniqueIndex('unq_org_eval').on(table.organizationId, table.patientId, table.ruleId, table.eventId)
]);
