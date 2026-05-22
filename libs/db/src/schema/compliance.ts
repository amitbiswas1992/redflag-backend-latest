import { index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './identity';
import { riskRules } from './rules';

// ── Compliance Flags ─────────────────────────────────────────────────────────
// Written by RuleEvaluatorService after each ingestion job.
// violationContext stores the exact field values that triggered the flag so
// the UI can display precisely WHY the flag was raised.

export const complianceFlags = pgTable(
    'compliance_flags',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        organizationId: uuid('organization_id')
            .references(() => organizations.id, { onDelete: 'cascade' })
            .notNull(),
        entityType: text('entity_type').notNull(), // 'ENCOUNTER' | 'MEDICATION'
        entityId: uuid('entity_id').notNull(),
        patientId: uuid('patient_id'),
        providerName: text('provider_name'),
        // The rule that generated this flag (nullable for future system-generated flags)
        ruleId: uuid('rule_id').references(() => riskRules.id, {
            onDelete: 'set null',
        }),
        flagType: text('flag_type').notNull(), // rule_name at time of evaluation
        severity: text('severity').notNull(), // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
        description: text('description'),
        // Snapshot of exact field values that caused the violation
        // e.g. [{ "field": "is_telehealth", "actual_value": true, "condition": "= true" }]
        violationContext: jsonb('violation_context'),
        serial: integer('serial'),
        instanceId: text('instance_id'),
        resolvedAt: timestamp('resolved_at'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at')
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('idx_compliance_flags_org').on(table.organizationId),
        // Fast lookup: all flags for a specific rule
        index('idx_compliance_flags_rule').on(table.organizationId, table.ruleId),
        // Fast lookup: all flags for a specific entity (encounter/medication)
        index('idx_compliance_flags_entity').on(table.organizationId, table.entityId),
        // Prevent duplicate flags for the same entity + rule on re-ingestion
        uniqueIndex('unq_compliance_flags_org_entity_rule').on(
            table.organizationId,
            table.entityId,
            table.ruleId,
        ),
        unique('unq_compliance_flags_instance_id').on(table.instanceId),
    ],
);

// ── Risk Scores ──────────────────────────────────────────────────────────────
export const riskScores = pgTable(
    'risk_scores',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        organizationId: uuid('organization_id')
        .references(() => organizations.id, { onDelete: 'cascade' })
        .notNull(),
        entityType: text('entity_type').notNull(),
        entityId: uuid('entity_id').notNull(),
        complianceScore: integer('compliance_score').notNull(),
        riskLevel: text('risk_level').notNull(),
        category: text('category').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at')
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('idx_risk_scores_org').on(table.organizationId),
    ],
);

// ── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogs = pgTable(
    'audit_logs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        organizationId: uuid('organization_id')
            .references(() => organizations.id, { onDelete: 'cascade' })
            .notNull(),
        actorType: text('actor_type').notNull(),
        actorId: uuid('actor_id').notNull(),
        action: text('action').notNull(),
        resourceType: text('resource_type').notNull(),
        resourceId: text('resource_id').notNull(),
        changes: jsonb('changes').notNull(),
        timestamp: timestamp('timestamp').defaultNow().notNull(),
    },
    (table) => [
        index('idx_audit_logs_org').on(table.organizationId),
    ],
);
