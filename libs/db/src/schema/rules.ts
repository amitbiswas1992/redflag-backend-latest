import {
    boolean,
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './identity';

// ── Finding Categories ───────────────────────────────────────────────────────
// Logical groupings of rules, e.g. "Telehealth", "Misprescribing"

export const ruleCategories = pgTable(
    'rule_categories',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        organizationId: uuid('organization_id')
            .references(() => organizations.id, { onDelete: 'cascade' })
            .notNull(),
        name: text('name').notNull(),
        description: text('description'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at')
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('idx_rule_categories_org').on(table.organizationId),
    ],
);

// ── Risk Rules ───────────────────────────────────────────────────────────────
// Defines one compliance rule per row — fully dynamic, no hard-coded logic.
// targetTable tells the evaluator which analytics projection to query.

export const riskRules = pgTable(
    'risk_rules',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        organizationId: uuid('organization_id')
            .references(() => organizations.id, { onDelete: 'cascade' })
            .notNull(),
        categoryId: uuid('category_id').references(() => ruleCategories.id, {
            onDelete: 'set null',
        }),
        ruleName: text('rule_name').notNull(),
        ruleCode: text('rule_code'),
        // Which Layer-3 analytics projection this rule queries
        targetTable: text('target_table').notNull(), // 'encounter_analytics' | 'medication_analytics'
        severity: text('severity').notNull(), // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
        isActive: boolean('is_active').default(true).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at')
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        // Hot-path: fetch all active rules per org
        index('idx_risk_rules_org_active').on(table.organizationId, table.isActive),
        // Category filter for UI listing
        index('idx_risk_rules_category').on(table.organizationId, table.categoryId),
    ],
);

// ── Rule Conditions ──────────────────────────────────────────────────────────
// Each row represents one condition block within a rule.
// The `logicalOperator` field defines how THIS condition chains with the NEXT one.
// Conditions are applied in `order` sequence.

export const ruleConditions = pgTable(
    'rule_conditions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        ruleId: uuid('rule_id')
            .references(() => riskRules.id, { onDelete: 'cascade' })
            .notNull(),
        organizationId: uuid('organization_id')
            .references(() => organizations.id, { onDelete: 'cascade' })
            .notNull(),
        // Must match a snake_case column in the rule's targetTable
        fieldName: text('field_name').notNull(),
        // EQUALS | NOT_EQUALS | GREATER_THAN | LESS_THAN |
        // GREATER_THAN_EQUAL | LESS_THAN_EQUAL | IS_NULL | IS_NOT_NULL
        operator: text('operator').notNull(),
        // Threshold value stored as text; cast at compile time based on column type
        value: text('value'),
        // How this condition is chained with the NEXT condition (AND / OR)
        logicalOperator: text('logical_operator').default('AND').notNull(),
        order: integer('order').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at')
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('idx_rule_conditions_rule').on(table.ruleId),
        index('idx_rule_conditions_org').on(table.organizationId),
    ],
);
