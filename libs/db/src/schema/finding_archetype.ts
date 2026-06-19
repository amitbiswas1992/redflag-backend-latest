import {
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './identity';
import { riskRules } from './rules';

// ── Applicable Theory ─────────────────────────────────────────────────────────
// Stored as jsonb array within finding_archetypes.applicable_theories
// Shape: ApplicableTheory[]
// { law_ref: string; relevant_sentence: string; explanation: string }

// ── Score Factors ─────────────────────────────────────────────────────────────
// ScoreValidator = Record<'Scope' | 'Encounter' | 'FinancialCost' | 'BlastRadius' | 'PatientHarm' | 'TemporalExposure', 0-10>
// Stored as jsonb in finding_archetypes.score_factors

// ── Finding Archetypes ────────────────────────────────────────────────────────
// Canonical archetype definitions for compliance findings.
// parent_id enables hierarchical archetype trees.
// ruleId is unique: each rule has at most one root archetype (has-one relation).
// catalogId is surfaced to users via riskRules.ruleCode on the joined rule.

export const findingArchetypes = pgTable(
    'finding_archetypes',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        organizationId: uuid('organization_id')
            .references(() => organizations.id, { onDelete: 'cascade' })
            .notNull(),
        ruleId: uuid('rule_id').references(() => riskRules.id, {
            onDelete: 'set null',
        }),
        description: text('description'),
        severityRationale: text('severity_rationale'),
        // Array of { law_ref, relevant_sentence, explanation }
        applicableTheories: jsonb('applicable_theories'),
        parentId: uuid('parent_id'),
        // ScoreValidator: Record<'S'|'E'|'F'|'B'|'H'|'T', 0-10>
        scoreFactors: jsonb('score_factors'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at')
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('idx_finding_archetypes_org').on(table.organizationId),
        index('idx_finding_archetypes_rule').on(table.organizationId, table.ruleId),
        index('idx_finding_archetypes_parent').on(table.parentId),
        uniqueIndex('unq_finding_archetypes_rule_id').on(table.ruleId),
    ],
);
