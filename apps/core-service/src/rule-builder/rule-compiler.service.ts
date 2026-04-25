import { riskRules, ruleConditions } from '@app/db';
import { Injectable, Logger } from '@nestjs/common';
import { SQL, sql } from 'drizzle-orm';
import { ConditionOperator, TargetTable } from './dto/rule-builder.dto';

// Maps each analytics table -> column metadata.
// fieldName is validated against this registry before SQL is generated.
export type ColumnType = 'boolean' | 'integer' | 'text';

export interface ColumnMeta {
    type: ColumnType;
    label: string;
    description: string;
}

export const COLUMN_REGISTRY: Record<TargetTable, Record<string, ColumnMeta>> = {
    [TargetTable.ENCOUNTER_ANALYTICS]: {
        is_telehealth: {
            type: 'boolean',
            label: 'Is Telehealth',
            description: 'Whether the encounter was a telehealth visit',
        },
        encounter_type: {
            type: 'text',
            label: 'Encounter Type',
            description: 'Type of clinical encounter',
        },
        session_duration: {
            type: 'integer',
            label: 'Session Duration (min)',
            description: 'Length of the encounter in minutes',
        },
        chief_complaint: {
            type: 'text',
            label: 'Chief Complaint',
            description: 'Primary reason for the encounter',
        },
        primary_diagnosis: {
            type: 'text',
            label: 'Primary Diagnosis',
            description: 'Main diagnosis code or description',
        },
        vital_signs_recorded: {
            type: 'boolean',
            label: 'Vital Signs Recorded',
            description: 'Whether vital signs were captured',
        },
        provider_location_state: {
            type: 'text',
            label: 'Provider State',
            description: 'US state where provider is located',
        },
        patient_location_state: {
            type: 'text',
            label: 'Patient State',
            description: 'US state where patient is located',
        },
        cross_state_flag: {
            type: 'boolean',
            label: 'Cross-State Flag',
            description: 'Provider and patient in different states',
        },
        cross_state_license: {
            type: 'boolean',
            label: 'Cross-State License',
            description: 'Whether provider has valid cross-state license',
        },
        state_licensure_verified: {
            type: 'boolean',
            label: 'Licensure Verified',
            description: 'Provider licensure verified in patient state',
        },
        patient_identity_verified: {
            type: 'boolean',
            label: 'Identity Verified',
            description: 'Patient identity was verified',
        },
        consent_obtained: {
            type: 'boolean',
            label: 'Consent Obtained',
            description: 'General treatment consent obtained',
        },
        informed_consent_type: {
            type: 'text',
            label: 'Informed Consent Type',
            description: 'Specific type of informed consent',
        },
        session_recording_consent: {
            type: 'boolean',
            label: 'Recording Consent',
            description: 'Consent to record session',
        },
        hipaa_platform_validated: {
            type: 'boolean',
            label: 'HIPAA Validated',
            description: 'Platform meets HIPAA requirements',
        },
        clinical_notes_completed: {
            type: 'boolean',
            label: 'Notes Completed',
            description: 'Clinical notes are finalized',
        },
        note_signed_date: {
            type: 'text',
            label: 'Note Signed Date',
            description: 'Date when the clinical note was signed',
        },
        documentation_complete: {
            type: 'boolean',
            label: 'Documentation Complete',
            description: 'All required documentation is present',
        },
        mental_health_screening: {
            type: 'boolean',
            label: 'MH Screening',
            description: 'Mental health screening performed',
        },
        substance_use_screening: {
            type: 'boolean',
            label: 'SUD Screening',
            description: 'Substance use disorder screening performed',
        },
        allergies_reviewed: {
            type: 'boolean',
            label: 'Allergies Reviewed',
            description: 'Patient allergies were reviewed',
        },
        coordination_with_pcp: {
            type: 'boolean',
            label: 'PCP Coordination',
            description: 'Coordination with Primary Care Physician',
        },
        follow_up_scheduled: {
            type: 'boolean',
            label: 'Follow-up Scheduled',
            description: 'Next appointment is scheduled',
        },
        care_plan_updated: {
            type: 'boolean',
            label: 'Care Plan Updated',
            description: 'Clinical care plan was updated',
        },
        clinical_protocol_approved_by: {
            type: 'text',
            label: 'Protocol Approver',
            description: 'Who approved the clinical protocol',
        },
        corporate_structure: {
            type: 'text',
            label: 'Corporate Structure',
            description: 'Legal/corporate structure of entity',
        },
        physician_ownership_percentage: {
            type: 'integer',
            label: 'Physician Ownership %',
            description: 'Percentage of physician ownership',
        },
        clinical_decision_maker: {
            type: 'text',
            label: 'Clinical Decision Maker',
            description: 'Role of the primary decision maker',
        },
        clinical_decision_support: {
            type: 'boolean',
            label: 'CDS Used',
            description: 'Clinical Decision Support used',
        },
        cds_alert_count: {
            type: 'integer',
            label: 'CDS Alert Count',
            description: 'Number of CDS alerts triggered',
        },
        technology_assessment: {
            type: 'boolean',
            label: 'Tech Assessment',
            description: 'Technology/Platform assessment complete',
        },
        telehealth_id: {
            type: 'text',
            label: 'Telehealth ID',
            description: 'Internal ID of the telehealth session',
        },
        provider_name: {
            type: 'text',
            label: 'Provider Name',
            description: 'Name of the healthcare provider',
        },
        quality_measure_met: {
            type: 'boolean',
            label: 'Quality Measure Met',
            description: 'Standard quality measure was achieved',
        },
        override_reason: {
            type: 'text',
            label: 'Override Reason',
            description: 'Reason for clinical protocol override',
        },
        controlled_substance_prescribed: {
            type: 'boolean',
            label: 'CS Prescribed',
            description: 'Controlled substance was prescribed in this encounter context',
        },
        medication_prescribed: {
            type: 'text',
            label: 'Medication Prescribed',
            description: 'Medication name from associated prescription context',
        },
        prescriber_dea: {
            type: 'text',
            label: 'Prescriber DEA',
            description: 'DEA number from associated prescriber context',
        },
        auto_refill_policy_corporate_mandated: {
            type: 'boolean',
            label: 'Corporate Auto-Refill',
            description: 'Organization policy mandates auto-refill behavior',
        },
    },
    [TargetTable.MEDICATION_ANALYTICS]: {
        controlled_substance: {
            type: 'boolean',
            label: 'Controlled Substance',
            description: 'Medication is a controlled substance',
        },
        controlled_substance_prescribed: {
            type: 'boolean',
            label: 'CS Prescribed',
            description: 'Controlled substance was actually prescribed',
        },
        dea_schedule: {
            type: 'text',
            label: 'DEA Schedule',
            description: 'DEA schedule (I-V)',
        },
        refill_count: {
            type: 'integer',
            label: 'Refill Count',
            description: 'Number of authorized refills',
        },
        auto_refill_enabled: {
            type: 'boolean',
            label: 'Auto-Refill Enabled',
            description: 'Automatic refill is enabled',
        },
        auto_refill_policy_corporate_mandated: {
            type: 'boolean',
            label: 'Corporate Auto-Refill',
            description: 'Auto-refill mandated by corporate',
        },
        medication_prescribed: {
            type: 'text',
            label: 'Medication Prescribed',
            description: 'Name of medication prescribed',
        },
        medication_adherence: {
            type: 'text',
            label: 'Medication Adherence',
            description: 'Patient adherence status',
        },
        prescriber_dea: {
            type: 'text',
            label: 'Prescriber DEA',
            description: 'Prescriber DEA registration number',
        },
        follow_up_scheduled: {
            type: 'boolean',
            label: 'Follow-up Scheduled',
            description: 'Whether follow-up was scheduled for this prescription context',
        },
        care_plan_updated: {
            type: 'boolean',
            label: 'Care Plan Updated',
            description: 'Whether care plan was updated in this prescription context',
        },
        vital_signs_recorded: {
            type: 'boolean',
            label: 'Vital Signs Recorded',
            description: 'Whether vitals were recorded in linked encounter context',
        },
        coordination_with_pcp: {
            type: 'boolean',
            label: 'PCP Coordination',
            description: 'Whether PCP coordination exists in linked encounter context',
        },
        clinical_decision_support: {
            type: 'boolean',
            label: 'CDS Used',
            description: 'Whether CDS evidence exists in linked encounter context',
        },
        cds_alert_count: {
            type: 'integer',
            label: 'CDS Alert Count',
            description: 'Number of CDS alerts in linked encounter context',
        },
        override_reason: {
            type: 'text',
            label: 'Override Reason',
            description: 'Reason for overriding CDS or policy checks',
        },
        substance_code: {
            type: 'text',
            label: 'Substance Code',
            description: 'Code for the underlying substance',
        },
        substance_quantity: {
            type: 'integer',
            label: 'Substance Quantity',
            description: 'Quantity of substance dispensed',
        },
        substance_expiry: {
            type: 'text',
            label: 'Substance Expiry',
            description: 'Expiration date of substance',
        },
    },
};

type RuleRow = typeof riskRules.$inferSelect;
type ConditionRow = typeof ruleConditions.$inferSelect;
type CompiledCondition = {
    sql: SQL;
    logicalOperator: string;
    fieldName: string;
    columnRef: SQL;
};

export type RuleWithConditions = RuleRow & { conditions: ConditionRow[] };

@Injectable()
export class RuleCompilerService {
    private readonly logger = new Logger(RuleCompilerService.name);

    compile(rule: RuleWithConditions, orgId: string, entityIds: string[]): SQL | null {
        if (!rule.conditions.length) {
            this.logger.warn(`Rule ${rule.id} has no conditions - skipped`);
            return null;
        }

        const tableKey = rule.targetTable as TargetTable;
        const registry = COLUMN_REGISTRY[tableKey];
        if (!registry) {
            this.logger.warn(
                `Rule ${rule.id} has unknown targetTable "${rule.targetTable}" - skipped`,
            );
            return null;
        }

        const alias =
            tableKey === TargetTable.ENCOUNTER_ANALYTICS ? 'ea' : 'ma';
        const idColumnName =
            tableKey === TargetTable.ENCOUNTER_ANALYTICS
                ? 'encounter_id'
                : 'medication_id';
        const entityType =
            tableKey === TargetTable.ENCOUNTER_ANALYTICS
                ? 'ENCOUNTER'
                : 'MEDICATION';

        const tableIdent = this.quoteIdentifier(tableKey);
        if (!tableIdent) {
            this.logger.warn(
                `Rule ${rule.id} has unsafe targetTable "${rule.targetTable}" - skipped`,
            );
            return null;
        }

        const entityIdRef = this.buildColumnReference(alias, idColumnName);
        const orgIdRef = this.buildColumnReference(alias, 'organization_id');
        if (!entityIdRef || !orgIdRef) {
            this.logger.warn(`Rule ${rule.id} has invalid internal column refs - skipped`);
            return null;
        }

        const compiledConditions: CompiledCondition[] = [];
        const sorted = [...rule.conditions].sort((a, b) => a.order - b.order);

        for (const cond of sorted) {
            const colMeta = registry[cond.fieldName];
            if (!colMeta) {
                this.logger.warn(
                    `Rule ${rule.id}: unknown fieldName "${cond.fieldName}" for table "${rule.targetTable}" - condition skipped`,
                );
                continue;
            }

            const columnRef = this.buildColumnReference(alias, cond.fieldName);
            if (!columnRef) {
                this.logger.warn(
                    `Rule ${rule.id}: invalid identifier for fieldName "${cond.fieldName}" - condition skipped`,
                );
                continue;
            }

            const condSql = this.buildConditionSql(columnRef, cond, colMeta.type);
            if (!condSql) continue;

            compiledConditions.push({
                sql: condSql,
                logicalOperator: cond.logicalOperator ?? 'AND',
                fieldName: cond.fieldName,
                columnRef,
            });
        }

        if (!compiledConditions.length) {
            this.logger.warn(`Rule ${rule.id} compiled to zero valid conditions - skipped`);
            return null;
        }

        const whereSql = this.chainConditions(compiledConditions);

        // Build rich violation context: rule metadata + actual field values
        const actualValuePairs = compiledConditions.map((part) =>
            sql`${part.fieldName}::text, ${part.columnRef}`,
        );
        const violationContextSql = sql`jsonb_build_object(
            'ruleCode'::text, ${rule.ruleCode ?? rule.id}::text,
            'ruleName'::text, ${rule.ruleName}::text,
            'severity'::text, ${rule.severity}::text,
            'actualValues'::text, jsonb_build_object(${sql.join(actualValuePairs, sql`, `)})
        )`;

        const entityIdsParam = sql`ARRAY[${sql.join(
            entityIds.map((id) => sql`${id}`),
            sql`, `,
        )}]::uuid[]`;

        return sql`
SELECT
    ${entityIdRef} AS entity_id,
    ${entityType} AS entity_type,
    ${rule.id}::uuid AS rule_id,
    ${rule.severity} AS severity,
    ${rule.ruleName} AS flag_type,
    ${violationContextSql} AS violation_context
FROM ${sql.raw(tableIdent)} ${sql.raw(alias)}
WHERE ${orgIdRef} = ${orgId}::uuid
    AND ${entityIdRef} = ANY(${entityIdsParam})
    AND ${whereSql}`;
    }

    private buildConditionSql(
        colRef: SQL,
        cond: ConditionRow,
        type: ColumnType,
    ): SQL | null {
        const op = cond.operator as ConditionOperator;

        if (op === ConditionOperator.IS_NULL) return sql`${colRef} IS NULL`;
        if (op === ConditionOperator.IS_NOT_NULL) return sql`${colRef} IS NOT NULL`;

        const castVal = this.castValue(cond.value ?? '', type);
        if (castVal === null) return null;

        switch (op) {
            case ConditionOperator.EQUALS:
                return sql`${colRef} = ${castVal}`;
            case ConditionOperator.NOT_EQUALS:
                return sql`${colRef} != ${castVal}`;
            case ConditionOperator.GREATER_THAN:
                return sql`${colRef} > ${castVal}`;
            case ConditionOperator.LESS_THAN:
                return sql`${colRef} < ${castVal}`;
            case ConditionOperator.GREATER_THAN_OR_EQUAL:
                return sql`${colRef} >= ${castVal}`;
            case ConditionOperator.LESS_THAN_OR_EQUAL:
                return sql`${colRef} <= ${castVal}`;
            case ConditionOperator.CONTAINS:
                return sql`CAST(${colRef} AS text) ILIKE ${'%' + String(cond.value ?? '') + '%'}`;
            case ConditionOperator.NOT_CONTAINS:
                return sql`CAST(${colRef} AS text) NOT ILIKE ${'%' + String(cond.value ?? '') + '%'}`;
            case ConditionOperator.IN: {
                const values = this.castList(cond.value ?? '', type);
                if (!values.length) return null;
                return sql`${colRef} = ANY(ARRAY[${sql.join(values, sql`, `)}])`;
            }
            case ConditionOperator.NOT_IN: {
                const values = this.castList(cond.value ?? '', type);
                if (!values.length) return null;
                return sql`NOT (${colRef} = ANY(ARRAY[${sql.join(values, sql`, `)}]))`;
            }
            default:
                this.logger.warn(`Unknown operator "${String(op)}" - skipped`);
                return null;
        }
    }

    private castList(rawList: string, type: ColumnType): SQL[] {
        const values = rawList
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        if (!values.length) return [];

        const castValues: SQL[] = [];
        for (const value of values) {
            const casted = this.castValue(value, type);
            if (!casted) return [];
            castValues.push(casted);
        }

        return castValues;
    }

    private castValue(raw: string, type: ColumnType): SQL | null {
        if (type === 'boolean') {
            const lower = raw.toLowerCase().trim();
            if (lower === 'true') return sql.raw('true');
            if (lower === 'false') return sql.raw('false');
            return null;
        }

        if (type === 'integer') {
            const n = Number.parseInt(raw, 10);
            if (Number.isNaN(n)) return null;
            return sql`${n}`;
        }

        return sql`${raw}`;
    }

    private chainConditions(parts: CompiledCondition[]): SQL {
        if (parts.length === 1) return parts[0].sql;

        let result = parts[0].sql;
        for (let i = 1; i < parts.length; i++) {
            const prevLogical = (parts[i - 1]?.logicalOperator ?? 'AND').toUpperCase();
            if (prevLogical === 'OR') {
                result = sql`(${result} OR ${parts[i].sql})`;
            } else {
                result = sql`(${result} AND ${parts[i].sql})`;
            }
        }

        return result;
    }

    private buildColumnReference(alias: string, columnName: string): SQL | null {
        const quotedColumn = this.quoteIdentifier(columnName);
        if (!quotedColumn) return null;
        return sql.raw(`${alias}.${quotedColumn}`);
    }

    private quoteIdentifier(identifier: string): string | null {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
            return null;
        }
        return `"${identifier}"`;
    }

    isValidField(targetTable: TargetTable, fieldName: string): boolean {
        return fieldName in (COLUMN_REGISTRY[targetTable] ?? {});
    }
}
