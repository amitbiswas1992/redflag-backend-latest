import { Injectable, Logger } from '@nestjs/common';
import { SQL, sql } from 'drizzle-orm';
import { ruleConditions, riskRules } from '@app/db';
import { ConditionOperator, TargetTable } from './dto/rule-builder.dto';

// ── Column metadata registry ──────────────────────────────────────────────────
// Maps each analytics table → column → type so the compiler can cast values
// correctly without risking SQL injection (fieldName validated against this set).

export type ColumnType = 'boolean' | 'integer' | 'text';

export interface ColumnMeta {
    type: ColumnType;
    label: string;
    description: string;
}

export const COLUMN_REGISTRY: Record<TargetTable, Record<string, ColumnMeta>> = {
    [TargetTable.ENCOUNTER_ANALYTICS]: {
        is_telehealth: { type: 'boolean', label: 'Is Telehealth', description: 'Whether the encounter was a telehealth visit' },
        cross_state_flag: { type: 'boolean', label: 'Cross-State Flag', description: 'Provider and patient in different states' },
        hipaa_platform_validated: { type: 'boolean', label: 'HIPAA Platform Validated', description: 'Platform meets HIPAA requirements' },
        duration_minutes: { type: 'integer', label: 'Duration (minutes)', description: 'Length of encounter in minutes' },
        documentation_complete: { type: 'boolean', label: 'Documentation Complete', description: 'Clinical notes fully completed' },
        patient_identity_verified: { type: 'boolean', label: 'Patient Identity Verified', description: 'Patient identity was verified before session' },
        session_recording_consent: { type: 'boolean', label: 'Session Recording Consent', description: 'Patient consented to session recording' },
        provider_location_state: { type: 'text', label: 'Provider Location State', description: 'US state where provider is located' },
        patient_location_state: { type: 'text', label: 'Patient Location State', description: 'US state where patient is located' },
        state_licensure_verified: { type: 'boolean', label: 'State Licensure Verified', description: 'Provider has verified licensure in patient state' },
    },
    [TargetTable.MEDICATION_ANALYTICS]: {
        controlled_substance: { type: 'boolean', label: 'Controlled Substance', description: 'Whether medication is a controlled substance' },
        dea_schedule: { type: 'text', label: 'DEA Schedule', description: 'DEA controlled substance schedule (I–V)' },
        refill_count: { type: 'integer', label: 'Refill Count', description: 'Number of authorized refills' },
        auto_refill_enabled: { type: 'boolean', label: 'Auto-Refill Enabled', description: 'Automatic refill is enabled' },
        medication_adherence: { type: 'text', label: 'Medication Adherence', description: 'Patient adherence classification' },
        prescriber_dea: { type: 'text', label: 'Prescriber DEA', description: 'Prescriber DEA registration number' },
    },
};

// ── Compiled rule fragment ────────────────────────────────────────────────────

export interface CompiledRuleFragment {
    /** Full SELECT … FROM … WHERE … SQL fragment (one per rule) */
    selectSql: SQL;
}

type RuleRow = typeof riskRules.$inferSelect;
type ConditionRow = typeof ruleConditions.$inferSelect;
export type RuleWithConditions = RuleRow & { conditions: ConditionRow[] };

@Injectable()
export class RuleCompilerService {
    private readonly logger = new Logger(RuleCompilerService.name);

    /**
     * Compile a single rule with its conditions into a SQL SELECT fragment.
     * Returns null if the rule has no valid conditions or an unknown target table.
     */
    compile(
        rule: RuleWithConditions,
        orgId: string,
        entityIds: string[],
    ): SQL | null {
        if (!rule.conditions.length) {
            this.logger.warn(`Rule ${rule.id} has no conditions — skipped`);
            return null;
        }

        const tableKey = rule.targetTable as TargetTable;
        const registry = COLUMN_REGISTRY[tableKey];
        if (!registry) {
            this.logger.warn(`Rule ${rule.id} has unknown targetTable "${rule.targetTable}" — skipped`);
            return null;
        }

        const alias = tableKey === TargetTable.ENCOUNTER_ANALYTICS ? 'ea' : 'ma';
        const idColumn =
            tableKey === TargetTable.ENCOUNTER_ANALYTICS
                ? 'encounter_id'
                : 'medication_id';
        const entityType =
            tableKey === TargetTable.ENCOUNTER_ANALYTICS ? 'ENCOUNTER' : 'MEDICATION';

        // Build WHERE condition for each rule condition
        const conditionSqlParts: SQL[] = [];
        const violationContextFields: string[] = []; // columns included in violation snapshot

        const sorted = [...rule.conditions].sort((a, b) => a.order - b.order);

        for (const cond of sorted) {
            const colMeta = registry[cond.fieldName];
            if (!colMeta) {
                this.logger.warn(
                    `Rule ${rule.id}: unknown fieldName "${cond.fieldName}" for table "${rule.targetTable}" — condition skipped`,
                );
                continue;
            }

            violationContextFields.push(cond.fieldName);
            const condSql = this.buildConditionSql(alias, cond, colMeta.type);
            if (!condSql) continue;

            conditionSqlParts.push(condSql);
        }

        if (!conditionSqlParts.length) {
            this.logger.warn(`Rule ${rule.id} compiled to zero valid conditions — skipped`);
            return null;
        }

        // Chain conditions respecting logicalOperator of each condition
        const whereSql = this.chainConditions(conditionSqlParts, sorted);

        // Build jsonb_build_object for violation_context
        const contextPairs: SQL[] = violationContextFields.map(
            (field) => sql.raw(`'${field}', ${alias}.${field}`),
        );
        const violationContextSql = sql`jsonb_build_object(${sql.join(contextPairs, sql`, `)})`;

        const entityIdsParam = sql`${entityIds}::uuid[]`;

        return sql`
SELECT
    ${sql.raw(`${alias}.${idColumn}`)} AS entity_id,
    ${entityType} AS entity_type,
    ${rule.id}::uuid AS rule_id,
    ${rule.severity} AS severity,
    ${rule.ruleName} AS flag_type,
    ${violationContextSql} AS violation_context
FROM ${sql.raw(rule.targetTable)} ${sql.raw(alias)}
WHERE ${sql.raw(`${alias}.organization_id`)} = ${orgId}::uuid
    AND ${sql.raw(`${alias}.${idColumn}`)} = ANY(${entityIdsParam})
    AND ${whereSql}`;
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private buildConditionSql(
        alias: string,
        cond: ConditionRow,
        type: ColumnType,
    ): SQL | null {
        const colRef = sql.raw(`${alias}.${cond.fieldName}`);
        const op = cond.operator as ConditionOperator;

        if (op === ConditionOperator.IS_NULL) return sql`${colRef} IS NULL`;
        if (op === ConditionOperator.IS_NOT_NULL) return sql`${colRef} IS NOT NULL`;

        const castVal = this.castValue(cond.value ?? '', type);
        if (castVal === null) return null;

        switch (op) {
            case ConditionOperator.EQUALS: return sql`${colRef} = ${castVal}`;
            case ConditionOperator.NOT_EQUALS: return sql`${colRef} != ${castVal}`;
            case ConditionOperator.GREATER_THAN: return sql`${colRef} > ${castVal}`;
            case ConditionOperator.LESS_THAN: return sql`${colRef} < ${castVal}`;
            case ConditionOperator.GREATER_THAN_EQUAL: return sql`${colRef} >= ${castVal}`;
            case ConditionOperator.LESS_THAN_EQUAL: return sql`${colRef} <= ${castVal}`;
            default:
                this.logger.warn(`Unknown operator "${String(op)}" — skipped`);
                return null;
        }
    }

    private castValue(raw: string, type: ColumnType): SQL | null {
        if (type === 'boolean') {
            const lower = raw.toLowerCase().trim();
            if (lower === 'true') return sql.raw('true');
            if (lower === 'false') return sql.raw('false');
            return null;
        }
        if (type === 'integer') {
            const n = parseInt(raw, 10);
            if (Number.isNaN(n)) return null;
            return sql`${n}`;
        }
        // text
        return sql`${raw}`;
    }

    /**
     * Chain condition SQL parts using the logicalOperator of each condition
     * (which defines how it chains with the NEXT one).
     * Last condition's logicalOperator is ignored.
     */
    private chainConditions(parts: SQL[], sorted: ConditionRow[]): SQL {
        if (parts.length === 1) return parts[0];

        let result = parts[0];
        for (let i = 1; i < parts.length; i++) {
            const prevLogical = (sorted[i - 1]?.logicalOperator ?? 'AND').toUpperCase();
            if (prevLogical === 'OR') {
                result = sql`(${result} OR ${parts[i]})`;
            } else {
                result = sql`(${result} AND ${parts[i]})`;
            }
        }
        return result;
    }

    /** Validates that a fieldName is whitelisted for the given target table */
    isValidField(targetTable: TargetTable, fieldName: string): boolean {
        return fieldName in (COLUMN_REGISTRY[targetTable] ?? {});
    }
}
