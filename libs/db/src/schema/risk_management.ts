import { index, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './identity';
import { complianceFlags } from './compliance';
import { riskRules } from './rules';

export const rootCauseTypeEnum = pgEnum('root_cause_type', [
    'workflow-gap',
    'training-issue',
    'system-limitation',
    'resource-constraint',
]);

export const riskManagementPlanTypeEnum = pgEnum('risk_management_plan_type', [
    'mitigate',
    'accept',
    'risk-transfer',
]);

// ── Risk Management Plans ────────────────────────────────────────────────────
export const riskManagementPlans = pgTable(
    'risk_management_plans',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        riskRuleId: uuid('risk_rule_id').references(() => riskRules.id, {
            onDelete: 'set null',
        }),
        title: text('title').notNull(),
        dueDate: timestamp('due_date').notNull(),
        type: riskManagementPlanTypeEnum('type').notNull().default('mitigate'),
        rootCauseType: rootCauseTypeEnum('root_cause_type').notNull(),
        impactAnalysis: text('impact_analysis').notNull(),
        justification: text('justification').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at')
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('idx_risk_management_plans_rule').on(table.riskRuleId),
    ],
);

// ── Risk Management Plan ↔ Compliance Flags (many-to-many) ───────────────────
export const riskManagementPlanComplianceFlags = pgTable(
    'risk_management_plan_compliance_flags',
    {
        riskManagementPlanId: uuid('risk_management_plan_id')
            .references(() => riskManagementPlans.id, { onDelete: 'cascade' })
            .notNull(),
        complianceFlagId: uuid('compliance_flag_id')
            .references(() => complianceFlags.id, { onDelete: 'cascade' })
            .notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.riskManagementPlanId, table.complianceFlagId] }),
        index('idx_rmp_compliance_flags_plan').on(table.riskManagementPlanId),
        index('idx_rmp_compliance_flags_flag').on(table.complianceFlagId),
    ],
);

// ── Risk Management Plan ↔ Assignees (many-to-many) ──────────────────────────
export const riskManagementPlanAssignees = pgTable(
    'risk_management_plan_assignees',
    {
        riskManagementPlanId: uuid('risk_management_plan_id')
            .references(() => riskManagementPlans.id, { onDelete: 'cascade' })
            .notNull(),
        userId: uuid('user_id')
            .references(() => users.id, { onDelete: 'cascade' })
            .notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.riskManagementPlanId, table.userId] }),
        index('idx_rmp_assignees_plan').on(table.riskManagementPlanId),
        index('idx_rmp_assignees_user').on(table.userId),
    ],
);
