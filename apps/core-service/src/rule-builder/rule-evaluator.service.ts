import { auditLogs, db, riskRules, ruleConditions } from '@app/db';
import { Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { TargetTable } from './dto/rule-builder.dto';
import { RuleCompilerService, RuleWithConditions } from './rule-compiler.service';

export interface EvaluationResult {
    rulesEvaluated: number;
    flagsInserted: number;
    encounterRulesCompiled: number;
    medicationRulesCompiled: number;
}

@Injectable()
export class RuleEvaluatorService {
    private readonly logger = new Logger(RuleEvaluatorService.name);

    constructor(private readonly compiler: RuleCompilerService) {}

    /**
     * Main entry point — called once per ingestion job AFTER all rows are materialized.
     *
     * Scalability guarantee:
     *   - 2 DB roundtrips regardless of rule count (one per analytics table)
     *   - All flags inserted in a single bulk INSERT … ON CONFLICT DO NOTHING
     *   - Zero Node.js memory iteration over individual records
     */
    async evaluateJob(
        organizationId: string,
        encounterIds: string[],
        medicationIds: string[],
    ): Promise<EvaluationResult> {
        const result: EvaluationResult = {
            rulesEvaluated: 0,
            flagsInserted: 0,
            encounterRulesCompiled: 0,
            medicationRulesCompiled: 0,
        };

        if (!encounterIds.length && !medicationIds.length) {
            this.logger.log(`evaluateJob skipped — no entity IDs provided`);
            return result;
        }

        // ── 1. Fetch all active rules + conditions in ONE query ───────────────
        const rules = await this.fetchActiveRulesWithConditions(organizationId);
        if (!rules.length) {
            this.logger.log(`evaluateJob: no active rules for org ${organizationId}`);
            return result;
        }

        result.rulesEvaluated = rules.length;

        // ── 2. Split rules by target table ────────────────────────────────────
        const encounterRules = encounterIds.length
            ? rules.filter((r) => (r.targetTable as TargetTable) === TargetTable.ENCOUNTER_ANALYTICS)
            : [];
        const medicationRules = medicationIds.length
            ? rules.filter((r) => (r.targetTable as TargetTable) === TargetTable.MEDICATION_ANALYTICS)
            : [];

        // ── 3. Evaluate encounter rules ───────────────────────────────────────
        if (encounterRules.length && encounterIds.length) {
            const inserted = await this.runBulkEvaluation(
                organizationId,
                encounterRules,
                encounterIds,
                'encounter',
            );
            result.encounterRulesCompiled = encounterRules.length;
            result.flagsInserted += inserted;
        }

        // ── 4. Evaluate medication rules ──────────────────────────────────────
        if (medicationRules.length && medicationIds.length) {
            const inserted = await this.runBulkEvaluation(
                organizationId,
                medicationRules,
                medicationIds,
                'medication',
            );
            result.medicationRulesCompiled = medicationRules.length;
            result.flagsInserted += inserted;
        }

        // ── 5. Audit log ──────────────────────────────────────────────────────
        if (result.flagsInserted > 0) {
            await db.insert(auditLogs).values({
                organizationId,
                actorType: 'SYSTEM',
                actorId: '00000000-0000-0000-0000-000000000000',
                action: 'RULE_ENGINE_EVALUATION_COMPLETED',
                resourceType: 'INGESTION_JOB',
                resourceId: organizationId,
                changes: {
                    rulesEvaluated: result.rulesEvaluated,
                    encounterRulesCompiled: result.encounterRulesCompiled,
                    medicationRulesCompiled: result.medicationRulesCompiled,
                    flagsInserted: result.flagsInserted,
                    encounterIdsCount: encounterIds.length,
                    medicationIdsCount: medicationIds.length,
                },
            });
        }

        this.logger.log(
            `evaluateJob complete — ${result.rulesEvaluated} rules, ${result.flagsInserted} flags inserted`,
        );
        return result;
    }

    // ── Private: Core bulk evaluation ─────────────────────────────────────────

    /**
     * Compiles all rules for one analytics table into a UNION ALL CTE and
     * executes a single INSERT ... SELECT statement.
     *
     * Returns the number of flags actually inserted.
     */
    private async runBulkEvaluation(
        organizationId: string,
        rules: RuleWithConditions[],
        entityIds: string[],
        label: string,
    ): Promise<number> {
        // Build one SELECT fragment per rule
        const fragments = rules
            .map((rule) => this.compiler.compile(rule, organizationId, entityIds))
            .filter((f): f is NonNullable<typeof f> => f !== null);

        if (!fragments.length) {
            this.logger.log(`runBulkEvaluation (${label}): no compilable rules`);
            return 0;
        }

        this.logger.log(
            `runBulkEvaluation (${label}): ${fragments.length} rules compiled into UNION ALL`,
        );

        // UNION ALL across all compiled fragments → single CTE
        const unionSql =
            fragments.length === 1
                ? fragments[0]
                : fragments.reduce((acc, frag) => sql`${acc} UNION ALL ${frag}`);

        // INSERT … SELECT from the CTE — one DB roundtrip for all rules
        let insertResult: unknown;
        try {
            insertResult = await db.execute(sql`
                WITH violations AS (
                    ${unionSql}
                )
                INSERT INTO compliance_flags
                    (organization_id, entity_id, entity_type, rule_id, flag_type, severity, violation_context, updated_at)
                SELECT
                    ${organizationId}::uuid,
                    entity_id::uuid,
                    entity_type,
                    rule_id,
                    flag_type,
                    severity,
                    violation_context,
                    NOW()
                FROM violations
                ON CONFLICT DO NOTHING
                RETURNING id
            `);
        } catch (err: unknown) {
            const drizzleError = err as { message?: string; cause?: { message?: string }; query?: string };
            const pgMessage = drizzleError.cause?.message ?? 'unknown postgres error';
            this.logger.error(
                `runBulkEvaluation (${label}) query failed. Postgres cause: ${pgMessage}`,
            );
            throw err;
        }

        const inserted = Array.isArray(insertResult)
            ? insertResult.length
            : (insertResult as unknown as { rows: unknown[] }).rows?.length ?? 0;
        this.logger.log(`runBulkEvaluation (${label}): ${inserted} flags inserted`);

        // ── Backfill patient_id for encounter flags ─────────────────────────
        if (inserted > 0 && label === 'encounter') {
            await db.execute(sql`
                UPDATE compliance_flags cf
                SET patient_id = e.patient_id
                FROM encounters e
                WHERE cf.entity_id = e.id
                  AND cf.entity_type = 'ENCOUNTER'
                  AND cf.patient_id IS NULL
                  AND cf.organization_id = ${organizationId}::uuid
            `);
        }
        if (inserted > 0 && label === 'medication') {
            await db.execute(sql`
                UPDATE compliance_flags cf
                SET patient_id = m.patient_id
                FROM medications m
                WHERE cf.entity_id = m.id
                  AND cf.entity_type = 'MEDICATION'
                  AND cf.patient_id IS NULL
                  AND cf.organization_id = ${organizationId}::uuid
            `);
        }

        return inserted;
    }

    // ── Private: Rule fetching ────────────────────────────────────────────────

    private async fetchActiveRulesWithConditions(
        organizationId: string,
    ): Promise<RuleWithConditions[]> {
        const rules = await db
            .select()
            .from(riskRules)
            .where(
                and(
                    eq(riskRules.organizationId, organizationId),
                    eq(riskRules.isActive, true),
                ),
            );

        if (!rules.length) return [];

        const ruleIds = rules.map((r) => r.id);
        const conditions = await db
            .select()
            .from(ruleConditions)
            .where(
                and(
                    eq(ruleConditions.organizationId, organizationId),
                    inArray(ruleConditions.ruleId, ruleIds),
                ),
            );

        const conditionMap = new Map<string, typeof ruleConditions.$inferSelect[]>();
        for (const c of conditions) {
            const list = conditionMap.get(c.ruleId) ?? [];
            list.push(c);
            conditionMap.set(c.ruleId, list);
        }

        return rules.map((rule) => ({
            ...rule,
            conditions: (conditionMap.get(rule.id) ?? []).sort(
                (a, b) => a.order - b.order,
            ),
        }));
    }
}
