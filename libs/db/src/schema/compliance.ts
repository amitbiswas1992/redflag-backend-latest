import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './identity';

export const complianceFlags = pgTable('compliance_flags', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    flagType: text('flag_type').notNull(),
    severity: text('severity').notNull(),
    description: text('description'),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('idx_compliance_flags_org').on(table.organizationId),
]);

export const riskScores = pgTable('risk_scores', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    complianceScore: integer('compliance_score').notNull(),
    riskLevel: text('risk_level').notNull(),
    category: text('category').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('idx_risk_scores_org').on(table.organizationId),
]);

export const auditLogs = pgTable('audit_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    actorType: text('actor_type').notNull(),
    actorId: uuid('actor_id').notNull(),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    changes: jsonb('changes').notNull(),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => [
    index('idx_audit_logs_org').on(table.organizationId),
]);
