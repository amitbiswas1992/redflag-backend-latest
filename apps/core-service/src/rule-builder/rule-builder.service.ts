import {
    complianceFlags,
    db,
    encounters,
    findingArchetypes,
    medications,
    organizations,
    patients,
    riskManagementPlanComplianceFlags,
    riskManagementPlans,
    riskRules,
    ruleCategories,
    ruleConditions,
} from '@app/db';
import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, InferSelectModel, lt, notInArray, or, sql } from 'drizzle-orm';
import {
    CreateRiskRuleDto,
    CreateRuleCategoryDto,
    Severity,
    TargetTable,
    UpdateFlagDto,
    UpdateRiskRuleDto,
    UpdateRuleCategoryDto,
} from './dto/rule-builder.dto';
import { COLUMN_REGISTRY } from './rule-compiler.service';
import type { RequestContext } from '@app/common';

// ── Score calculation (mirrors frontend finding-archetypes/constants.ts) ──────

const SCORE_FACTORS_META = [
    { key: 'Scope' as const,            weight: 1,   fungible: true  },
    { key: 'Encounter' as const,        weight: 1.5, fungible: false },
    { key: 'FinancialCost' as const,    weight: 2,   fungible: true  },
    { key: 'BlastRadius' as const,      weight: 1.5, fungible: true  },
    { key: 'PatientHarm' as const,      weight: 2,   fungible: false },
    { key: 'TemporalExposure' as const, weight: 1,   fungible: true  },
] as const;

type ScoreKey = 'Scope' | 'Encounter' | 'FinancialCost' | 'BlastRadius' | 'PatientHarm' | 'TemporalExposure';
type ScoreFactors = Partial<Record<ScoreKey, number | null>>;
type ScoreTuning  = Partial<Record<ScoreKey, number>>;

function calcRiskScore(
    scoreFactors: ScoreFactors | null,
    tuning: ScoreTuning,
    override?: ScoreFactors | null,
): number | null {
    if (!scoreFactors) return null;
    let sum = 0;
    let wSum = 0;
    for (const f of SCORE_FACTORS_META) {
        const overrideVal = override?.[f.key];
        const base = overrideVal != null ? overrideVal : scoreFactors[f.key];
        if (base == null) continue;
        const multiplier = f.fungible ? ((tuning as Record<string, number>)[f.key] ?? 1.0) : 1.0;
        sum  += base * f.weight * multiplier;
        wSum += f.weight * multiplier;
    }
    return wSum > 0 ? sum / wSum : null;
}

function severityFromScore(score: number): string {
    if (score >= 7.5) return 'CRITICAL';
    if (score >= 5.0) return 'HIGH';
    if (score >= 2.5) return 'MEDIUM';
    return 'LOW';
}

// ── Sync helpers (exported so rule-evaluator and finding-archetype can call) ──

export async function syncRiskForFlags(ids: string[]): Promise<void> {
    if (!ids.length) return;

    const flags = await db
        .select({
            id:                  complianceFlags.id,
            organizationId:      complianceFlags.organizationId,
            ruleId:              complianceFlags.ruleId,
            scoreFactorsOverride: complianceFlags.scoreFactorsOverride,
        })
        .from(complianceFlags)
        .where(inArray(complianceFlags.id, ids));

    if (!flags.length) return;

    const orgIds  = [...new Set(flags.map(f => f.organizationId))];
    const ruleIds = [...new Set(flags.map(f => f.ruleId).filter((id): id is string => !!id))];

    const [orgs, archetypes] = await Promise.all([
        db.select({ id: organizations.id, scoreTuning: organizations.scoreTuning })
          .from(organizations)
          .where(inArray(organizations.id, orgIds)),
        ruleIds.length
            ? db.select({ ruleId: findingArchetypes.ruleId, scoreFactors: findingArchetypes.scoreFactors })
                .from(findingArchetypes)
                .where(inArray(findingArchetypes.ruleId, ruleIds))
            : Promise.resolve([] as { ruleId: string | null; scoreFactors: unknown }[]),
    ]);

    const orgTuningMap = new Map(orgs.map(o => [o.id, (o.scoreTuning ?? {}) as ScoreTuning]));
    const archetypeByRule = new Map<string, ScoreFactors | null>();
    for (const a of archetypes) {
        if (a.ruleId && !archetypeByRule.has(a.ruleId))
            archetypeByRule.set(a.ruleId, a.scoreFactors as ScoreFactors | null);
    }

    await Promise.all(flags.map(f => {
        const tuning       = orgTuningMap.get(f.organizationId) ?? {};
        const scoreFactors = f.ruleId ? (archetypeByRule.get(f.ruleId) ?? null) : null;
        const score        = calcRiskScore(scoreFactors, tuning, f.scoreFactorsOverride as ScoreFactors | null);
        const riskScore    = score ?? 5;
        const severity     = severityFromScore(riskScore);
        return db.update(complianceFlags)
            .set({ riskScore, severity, updatedAt: new Date() })
            .where(eq(complianceFlags.id, f.id));
    }));
}

export async function syncRiskForArchetype(archetypeId: string): Promise<void> {
    const [archetype] = await db
        .select({
            ruleId:       findingArchetypes.ruleId,
            scoreFactors: findingArchetypes.scoreFactors,
        })
        .from(findingArchetypes)
        .where(eq(findingArchetypes.id, archetypeId))
        .limit(1);

    if (!archetype?.ruleId || !archetype.scoreFactors) return;

    const flags = await db
        .select({
            id:                  complianceFlags.id,
            organizationId:      complianceFlags.organizationId,
            scoreFactorsOverride: complianceFlags.scoreFactorsOverride,
        })
        .from(complianceFlags)
        .where(eq(complianceFlags.ruleId, archetype.ruleId));

    if (!flags.length) return;

    const orgIds = [...new Set(flags.map(f => f.organizationId))];
    const orgs   = await db
        .select({ id: organizations.id, scoreTuning: organizations.scoreTuning })
        .from(organizations)
        .where(inArray(organizations.id, orgIds));
    const orgTuningMap = new Map(orgs.map(o => [o.id, (o.scoreTuning ?? {}) as ScoreTuning]));

    await Promise.all(flags.map(f => {
        const tuning    = orgTuningMap.get(f.organizationId) ?? {};
        const score     = calcRiskScore(
            archetype.scoreFactors as ScoreFactors | null,
            tuning,
            f.scoreFactorsOverride as ScoreFactors | null,
        );
        const riskScore = score ?? 5;
        const severity  = severityFromScore(riskScore);
        return db.update(complianceFlags)
            .set({ riskScore, severity, updatedAt: new Date() })
            .where(eq(complianceFlags.id, f.id));
    }));
}

@Injectable()
export class RuleBuilderService {
    private readonly logger = new Logger(RuleBuilderService.name);

    constructor(@Inject('REQUEST') private readonly request: RequestContext) { }

    private get orgId(): string {
        const id = this.request.session?.session.activeOrganizationId;
        if (!id) throw new BadRequestException('Missing organizationId');
        return id;
    }

    // ── Categories ────────────────────────────────────────────────────────────

    async createCategory(dto: CreateRuleCategoryDto) {
        const [cat] = await db
            .insert(ruleCategories)
            .values({
                organizationId: this.orgId,
                name: dto.name,
                prefix: dto.prefix,
                description: dto.description,
                updatedAt: new Date(),
            })
            .returning();
        return cat;
    }

    async listCategories() {
        return db
            .select()
            .from(ruleCategories)
            .where(eq(ruleCategories.organizationId, this.orgId))
            .orderBy(asc(ruleCategories.name));
    }

    async updateCategory(id: string, dto: UpdateRuleCategoryDto) {
        const [cat] = await db
            .update(ruleCategories)
            .set({ ...dto, updatedAt: new Date() })
            .where(and(eq(ruleCategories.id, id), eq(ruleCategories.organizationId, this.orgId)))
            .returning();
        if (!cat) throw new NotFoundException('Category not found');
        return cat;
    }

    async deleteCategory(id: string) {
        // Block deletion if rules exist under this category
        const linkedRules = await db
            .select({ id: riskRules.id })
            .from(riskRules)
            .where(and(eq(riskRules.categoryId, id), eq(riskRules.organizationId, this.orgId)))
            .limit(1);
        if (linkedRules.length) {
            throw new BadRequestException(
                'Cannot delete category with associated rules. Reassign or delete rules first.',
            );
        }
        const [deleted] = await db
            .delete(ruleCategories)
            .where(and(eq(ruleCategories.id, id), eq(ruleCategories.organizationId, this.orgId)))
            .returning({ id: ruleCategories.id });
        if (!deleted) throw new NotFoundException('Category not found');
        return { message: 'Category deleted' };
    }

    // ── Rules ─────────────────────────────────────────────────────────────────

    async createRule(dto: CreateRiskRuleDto) {
        this.validateConditionFields(dto.targetTable, dto.conditions ?? []);

        return db.transaction(async (tx) => {
            // Auto-assign serial within the category unless caller supplies one
            let serial = dto.serial;
            if (serial === undefined && dto.categoryId) {
                const [{ maxSerial }] = await tx
                    .select({ maxSerial: sql<number>`COALESCE(MAX(${riskRules.serial}), 0)` })
                    .from(riskRules)
                    .where(and(eq(riskRules.categoryId, dto.categoryId), eq(riskRules.organizationId, this.orgId)));
                serial = (maxSerial ?? 0) + 1;
            }

            const [rule] = await tx
                .insert(riskRules)
                .values({
                    organizationId: this.orgId,
                    categoryId: dto.categoryId ?? null,
                    ruleName: dto.ruleName,
                    ruleCode: dto.ruleCode ?? null,
                    targetTable: dto.targetTable,
                    severity: dto.severity,
                    serial: serial ?? null,
                    isActive: dto.isActive ?? true,
                    updatedAt: new Date(),
                })
                .returning();

            const condRows = (dto.conditions ?? []).map((c, idx) => ({
                ruleId: rule.id,
                organizationId: this.orgId,
                fieldName: c.fieldName,
                operator: c.operator,
                value: c.value ?? null,
                logicalOperator: c.logicalOperator,
                order: c.order ?? idx,
                updatedAt: new Date(),
            }));

            const conditions =
                condRows.length > 0
                    ? await tx.insert(ruleConditions).values(condRows).returning()
                    : [];

            return { ...rule, conditions };
        });
    }

    async listRules(filters: {
        page?: number;
        limit?: number;
        search?: string;
        severity?: Severity;
        isActive?: boolean;
        categoryId?: string;
        targetTable?: TargetTable;
    }) {
        const page = Math.max(1, filters.page ?? 1);
        const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
        const offset = (page - 1) * limit;

        const predicates = [eq(riskRules.organizationId, this.orgId)];
        if (typeof filters.isActive === 'boolean')
            predicates.push(eq(riskRules.isActive, filters.isActive));
        if (filters.categoryId)
            predicates.push(eq(riskRules.categoryId, filters.categoryId));
        if (filters.targetTable)
            predicates.push(eq(riskRules.targetTable, filters.targetTable));
        if (filters.severity) predicates.push(eq(riskRules.severity, filters.severity));
        if (filters.search?.trim()) {
            const token = `%${filters.search.trim()}%`;
            predicates.push(
                or(ilike(riskRules.ruleName, token), ilike(riskRules.ruleCode, token))!,
            );
        }

        const [{ total }] = await db
            .select({ total: count() })
            .from(riskRules)
            .where(and(...predicates));

        const rules = await db
            .select()
            .from(riskRules)
            .where(and(...predicates))
            .orderBy(desc(riskRules.createdAt))
            .limit(limit)
            .offset(offset);

        const data = await this.attachConditions(rules);

        // Attach categories for rules that have categoryId
        const categoryIds = rules
            .map((r) => r.categoryId)
            .filter((id): id is string => !!id);
        if (categoryIds.length) {
            const categories = await db
                .select()
                .from(ruleCategories)
                .where(
                    and(
                        eq(ruleCategories.organizationId, this.orgId),
                        inArray(ruleCategories.id, categoryIds),
                    ),
                );
            const categoryMap = new Map(categories.map((c) => [c.id, c]));
            for (const rule of data) {
                (rule as any).category = rule.categoryId
                    ? categoryMap.get(rule.categoryId) ?? null
                    : null;
            }
        }

        return {
            data,
            total: Number(total ?? 0),
            page,
            limit,
        };
    }

    async getRuleById(id: string) {
        const [rule] = await db
            .select()
            .from(riskRules)
            .where(and(eq(riskRules.id, id), eq(riskRules.organizationId, this.orgId)));
        if (!rule) throw new NotFoundException('Rule not found');

        const conditions = await db
            .select()
            .from(ruleConditions)
            .where(
                and(
                    eq(ruleConditions.ruleId, id),
                    eq(ruleConditions.organizationId, this.orgId),
                ),
            )
            .orderBy(asc(ruleConditions.order));

        return { ...rule, conditions };
    }

    async updateRule(id: string, dto: UpdateRiskRuleDto) {
        return db.transaction(async (tx) => {
            const [existing] = await tx
                .select({ targetTable: riskRules.targetTable, categoryId: riskRules.categoryId, serial: riskRules.serial })
                .from(riskRules)
                .where(and(eq(riskRules.id, id), eq(riskRules.organizationId, this.orgId)))
                .limit(1);
            if (!existing) throw new NotFoundException('Rule not found');

            const effectiveTargetTable =
                (dto.targetTable ?? existing.targetTable) as TargetTable;
            if (dto.conditions !== undefined) {
                this.validateConditionFields(effectiveTargetTable, dto.conditions);
            }

            // Recompute serial when moving to a different category (unless overridden)
            let serial = dto.serial;
            const newCategoryId = dto.categoryId !== undefined ? dto.categoryId : existing.categoryId;
            if (serial === undefined && newCategoryId && newCategoryId !== existing.categoryId) {
                const [{ maxSerial }] = await tx
                    .select({ maxSerial: sql<number>`COALESCE(MAX(${riskRules.serial}), 0)` })
                    .from(riskRules)
                    .where(and(eq(riskRules.categoryId, newCategoryId), eq(riskRules.organizationId, this.orgId)));
                serial = (maxSerial ?? 0) + 1;
            }

            const [rule] = await tx
                .update(riskRules)
                .set({
                    categoryId: dto.categoryId,
                    ruleName: dto.ruleName,
                    ruleCode: dto.ruleCode,
                    targetTable: dto.targetTable,
                    severity: dto.severity,
                    isActive: dto.isActive,
                    ...(serial !== undefined ? { serial } : {}),
                    updatedAt: new Date(),
                })
                .where(and(eq(riskRules.id, id), eq(riskRules.organizationId, this.orgId)))
                .returning();
            if (!rule) throw new NotFoundException('Rule not found');

            if (dto.conditions !== undefined) {
                await tx
                    .delete(ruleConditions)
                    .where(
                        and(
                            eq(ruleConditions.ruleId, id),
                            eq(ruleConditions.organizationId, this.orgId),
                        ),
                    );

                if (dto.conditions.length > 0) {
                    await tx.insert(ruleConditions).values(
                        dto.conditions.map((c, idx) => ({
                            ruleId: rule.id,
                            organizationId: this.orgId,
                            fieldName: c.fieldName,
                            operator: c.operator,
                            value: c.value ?? null,
                            logicalOperator: c.logicalOperator,
                            order: c.order ?? idx,
                            updatedAt: new Date(),
                        })),
                    );
                }
            }

            const conditions = await tx
                .select()
                .from(ruleConditions)
                .where(
                    and(
                        eq(ruleConditions.ruleId, rule.id),
                        eq(ruleConditions.organizationId, this.orgId),
                    ),
                )
                .orderBy(asc(ruleConditions.order));

            return { ...rule, conditions };
        });
    }

    async deleteRule(id: string) {
        const [deleted] = await db
            .delete(riskRules)
            .where(and(eq(riskRules.id, id), eq(riskRules.organizationId, this.orgId)))
            .returning({ id: riskRules.id });
        if (!deleted) throw new NotFoundException('Rule not found');
        return { message: 'Rule deleted' };
    }

    async toggleRule(id: string) {
        const [current] = await db
            .select({ isActive: riskRules.isActive })
            .from(riskRules)
            .where(and(eq(riskRules.id, id), eq(riskRules.organizationId, this.orgId)));
        if (!current) throw new NotFoundException('Rule not found');

        const [updated] = await db
            .update(riskRules)
            .set({ isActive: !current.isActive, updatedAt: new Date() })
            .where(and(eq(riskRules.id, id), eq(riskRules.organizationId, this.orgId)))
            .returning();
        return updated;
    }

    // ── Flags ─────────────────────────────────────────────────────────────────

    async listFlags(filters: {
        entityId?: string;
        ruleId?: string;
        severity?: string;
        status?: string;
        search?: string;
        sort?: string;
        page?: number;
        limit?: number;
    }) {
        const page = Math.max(1, filters.page ?? 1);
        const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
        const offset = (page - 1) * limit;

        const predicates = [eq(complianceFlags.organizationId, this.orgId)];
        if (filters.entityId) predicates.push(eq(complianceFlags.entityId, filters.entityId));
        if (filters.ruleId) predicates.push(eq(complianceFlags.ruleId, filters.ruleId));
        if (filters.severity) predicates.push(eq(complianceFlags.severity, filters.severity));

        if (filters.status === 'open') {
            const planFlagIds = db
                .select({ id: riskManagementPlanComplianceFlags.complianceFlagId })
                .from(riskManagementPlanComplianceFlags);
            predicates.push(notInArray(complianceFlags.id, planFlagIds));
        } else if (filters.status) {
            const matchingFlagIds = db
                .select({ id: riskManagementPlanComplianceFlags.complianceFlagId })
                .from(riskManagementPlanComplianceFlags)
                .innerJoin(
                    riskManagementPlans,
                    eq(riskManagementPlanComplianceFlags.riskManagementPlanId, riskManagementPlans.id),
                )
                .where(eq(riskManagementPlans.status, filters.status as any));
            predicates.push(inArray(complianceFlags.id, matchingFlagIds));
        }

        if (filters.search?.trim()) {
            const term = `%${filters.search.trim()}%`;
            const matchingRuleIds = db
                .select({ id: riskRules.id })
                .from(riskRules)
                .where(and(
                    eq(riskRules.organizationId, this.orgId),
                    or(ilike(riskRules.ruleName, term), ilike(riskRules.ruleCode, term))!,
                ));
            predicates.push(
                or(
                    ilike(complianceFlags.instanceId, term),
                    inArray(complianceFlags.ruleId, matchingRuleIds),
                )!,
            );
        }

        const orderBy =
            filters.sort === 'risk_desc'    ? desc(complianceFlags.riskScore)
            : filters.sort === 'instance_id' ? asc(complianceFlags.instanceId)
            : desc(complianceFlags.createdAt);

        const [{ total }] = await db
            .select({ total: count() })
            .from(complianceFlags)
            .where(and(...predicates));

        const flags = await db
            .select()
            .from(complianceFlags)
            .where(and(...predicates))
            .orderBy(orderBy)
            .limit(limit)
            .offset(offset);

        if (!flags.length) return { data: [], total: Number(total ?? 0), page, limit };

        const ruleIds = [...new Set(flags.map(f => f.ruleId).filter((id): id is string => !!id))];
        const flagIds = flags.map(f => f.id);

        const [rules, archetypes, planLinks] = await Promise.all([
            ruleIds.length
                ? db.select().from(riskRules).where(inArray(riskRules.id, ruleIds))
                : Promise.resolve([] as InferSelectModel<typeof riskRules>[]),
            ruleIds.length
                ? db.select().from(findingArchetypes).where(
                    and(
                        eq(findingArchetypes.organizationId, this.orgId),
                        inArray(findingArchetypes.ruleId, ruleIds),
                    ),
                )
                : Promise.resolve([] as InferSelectModel<typeof findingArchetypes>[]),
            db
                .select({
                    complianceFlagId: riskManagementPlanComplianceFlags.complianceFlagId,
                    plan: riskManagementPlans,
                })
                .from(riskManagementPlanComplianceFlags)
                .innerJoin(
                    riskManagementPlans,
                    eq(riskManagementPlanComplianceFlags.riskManagementPlanId, riskManagementPlans.id),
                )
                .where(inArray(riskManagementPlanComplianceFlags.complianceFlagId, flagIds)),
        ]);

        const ruleMap = new Map(rules.map(r => [r.id, r]));
        // One archetype per ruleId — take the first if multiple exist
        const archetypeByRule = new Map<string, typeof archetypes[number]>();
        for (const a of archetypes) {
            if (a.ruleId && !archetypeByRule.has(a.ruleId)) archetypeByRule.set(a.ruleId, a);
        }
        const planByFlag = new Map(planLinks.map(p => [p.complianceFlagId, p.plan]));

        const data = flags.map(f => ({
            ...f,
            rule: f.ruleId ? (ruleMap.get(f.ruleId) ?? null) : null,
            findingArchetype: f.ruleId ? (archetypeByRule.get(f.ruleId) ?? null) : null,
            riskManagementPlan: planByFlag.get(f.id) ?? null,
        }));

        return { data, total: Number(total ?? 0), page, limit };
    }

    async updateFlag(id: string, dto: UpdateFlagDto) {
        // Read ruleId so we can look up the archetype scoreFactors
        const [existing] = await db
            .select({ ruleId: complianceFlags.ruleId })
            .from(complianceFlags)
            .where(and(eq(complianceFlags.id, id), eq(complianceFlags.organizationId, this.orgId)))
            .limit(1);
        if (!existing) throw new NotFoundException('Flag not found');

        const [archetypeRows, orgRows] = await Promise.all([
            existing.ruleId
                ? db.select({ scoreFactors: findingArchetypes.scoreFactors })
                    .from(findingArchetypes)
                    .where(and(
                        eq(findingArchetypes.organizationId, this.orgId),
                        eq(findingArchetypes.ruleId, existing.ruleId),
                    ))
                    .limit(1)
                : Promise.resolve([] as { scoreFactors: unknown }[]),
            db.select({ scoreTuning: organizations.scoreTuning })
                .from(organizations)
                .where(eq(organizations.id, this.orgId))
                .limit(1),
        ]);

        const scoreFactors = (archetypeRows[0]?.scoreFactors ?? null) as ScoreFactors | null;
        const tuning       = ((orgRows[0]?.scoreTuning ?? {}) as ScoreTuning);
        const newOverride  = (dto.scoreFactorsOverride ?? null) as ScoreFactors | null;
        const score        = calcRiskScore(scoreFactors, tuning, newOverride);
        const riskScore    = score ?? 5;
        const severity     = severityFromScore(riskScore);

        const [updated] = await db
            .update(complianceFlags)
            .set({
                scoreFactorsOverride: dto.scoreFactorsOverride ?? null,
                riskScore,
                severity,
                updatedAt: new Date(),
            })
            .where(and(eq(complianceFlags.id, id), eq(complianceFlags.organizationId, this.orgId)))
            .returning();
        if (!updated) throw new NotFoundException('Flag not found');
        return updated;
    }

    async getFlagStats() {
        const orgId = this.orgId;

        const bySeverity = await db
            .select({ severity: complianceFlags.severity, n: count() })
            .from(complianceFlags)
            .where(eq(complianceFlags.organizationId, orgId))
            .groupBy(complianceFlags.severity);

        const withPlanStatus = await db
            .select({ status: riskManagementPlans.status, n: count() })
            .from(riskManagementPlanComplianceFlags)
            .innerJoin(
                riskManagementPlans,
                eq(riskManagementPlanComplianceFlags.riskManagementPlanId, riskManagementPlans.id),
            )
            .innerJoin(
                complianceFlags,
                and(
                    eq(riskManagementPlanComplianceFlags.complianceFlagId, complianceFlags.id),
                    eq(complianceFlags.organizationId, orgId),
                ),
            )
            .groupBy(riskManagementPlans.status);

        const [{ slaBreaches }] = await db
            .select({ slaBreaches: count() })
            .from(riskManagementPlanComplianceFlags)
            .innerJoin(
                riskManagementPlans,
                eq(riskManagementPlanComplianceFlags.riskManagementPlanId, riskManagementPlans.id),
            )
            .innerJoin(
                complianceFlags,
                and(
                    eq(riskManagementPlanComplianceFlags.complianceFlagId, complianceFlags.id),
                    eq(complianceFlags.organizationId, orgId),
                ),
            )
            .where(
                and(
                    lt(riskManagementPlans.dueDate, new Date()),
                    sql`${riskManagementPlans.status} != 'completed'`,
                ),
            );

        const total = bySeverity.reduce((s, r) => s + Number(r.n), 0);
        const totalWithPlan = withPlanStatus.reduce((s, r) => s + Number(r.n), 0);
        const sevMap: Record<string, number> = {};
        for (const row of bySeverity) sevMap[row.severity] = Number(row.n);
        const statusMap: Record<string, number> = {};
        for (const row of withPlanStatus) statusMap[row.status] = Number(row.n);

        return {
            total,
            slaBreaches: Number(slaBreaches ?? 0),
            bySeverity: {
                CRITICAL: sevMap['CRITICAL'] ?? 0,
                HIGH: sevMap['HIGH'] ?? 0,
                MEDIUM: sevMap['MEDIUM'] ?? 0,
                LOW: sevMap['LOW'] ?? 0,
            },
            byStatus: {
                open: total - totalWithPlan,
                in_progress: statusMap['in_progress'] ?? 0,
                pending_validation: statusMap['pending_validation'] ?? 0,
                completed: statusMap['completed'] ?? 0,
            },
        };
    }

    /**
     * Get findings grouped by rule with aggregated flag counts.
     * Used by the Findings dashboard to show rule cards with issue counts.
     */
    async getFindingsByRule() {
        const flags = await db
            .select({
                ruleId: complianceFlags.ruleId,
                flagCount: count(),
                latestFlagAt: sql<string>`MAX(${complianceFlags.createdAt})`,
            })
            .from(complianceFlags)
            .where(eq(complianceFlags.organizationId, this.orgId))
            .groupBy(complianceFlags.ruleId);

        if (!flags.length) return [];

        const ruleIds = flags.map((f) => f.ruleId).filter((id): id is string => !!id);

        const rules = await db
            .select()
            .from(riskRules)
            .where(
                and(
                    eq(riskRules.organizationId, this.orgId),
                    inArray(riskRules.id, ruleIds),
                ),
            );

        const categories = await db
            .select()
            .from(ruleCategories)
            .where(
                and(
                    eq(ruleCategories.organizationId, this.orgId),
                    inArray(
                        ruleCategories.id,
                        rules.map((r) => r.categoryId).filter((id): id is string => !!id),
                    ),
                ),
            );

        const conditions = await db
            .select()
            .from(ruleConditions)
            .where(
                and(
                    eq(ruleConditions.organizationId, this.orgId),
                    inArray(ruleConditions.ruleId, ruleIds),
                ),
            )
            .orderBy(asc(ruleConditions.order));

        const categoryMap = new Map(categories.map((c) => [c.id, c]));
        const flagMap = new Map(flags.map((f) => [f.ruleId, f]));
        const conditionMap = new Map<string, typeof ruleConditions.$inferSelect[]>();
        for (const c of conditions) {
            const list = conditionMap.get(c.ruleId) ?? [];
            list.push(c);
            conditionMap.set(c.ruleId, list);
        }

        return rules.map((rule) => {
            const flagInfo = flagMap.get(rule.id);
            return {
                rule: {
                    ...rule,
                    category: rule.categoryId ? categoryMap.get(rule.categoryId) ?? null : null,
                    conditions: (conditionMap.get(rule.id) ?? []).sort((a, b) => a.order - b.order),
                },
                flagCount: Number(flagInfo?.flagCount ?? 0),
                latestFlagAt: flagInfo?.latestFlagAt ?? null,
            };
        });
    }

    /**
     * Get individual compliance flags for a specific rule with patient details and entity data.
     */
    async getFindingsDetail(ruleId: string) {
        const rows = await db
            .select({
                flag: complianceFlags,
                patientName: patients.name,
                patientSourceId: patients.sourceId,
                encounter: encounters,
                medication: medications,
                riskManagementPlanId: riskManagementPlanComplianceFlags.riskManagementPlanId,
            })
            .from(complianceFlags)
            .leftJoin(patients, eq(complianceFlags.patientId, patients.id))
            .leftJoin(encounters, eq(complianceFlags.entityId, encounters.id))
            .leftJoin(medications, eq(complianceFlags.entityId, medications.id))
            .leftJoin(
                riskManagementPlanComplianceFlags,
                eq(complianceFlags.id, riskManagementPlanComplianceFlags.complianceFlagId),
            )
            .where(
                and(
                    eq(complianceFlags.organizationId, this.orgId),
                    eq(complianceFlags.ruleId, ruleId),
                ),
            )
            .orderBy(desc(complianceFlags.createdAt))
            .limit(200);

        return rows.map(({ encounter, medication, flag, ...others }) => ({
            ...flag,
            ...others,
            entity: flag.entityType === 'ENCOUNTER' ? encounter : medication,
        }));
    }

    async getFlagByInstanceId(instanceId: string) {
        const orgId = this.orgId;

        const [row] = await db
            .select({
                flag:         complianceFlags,
                rule:         riskRules,
                archetype:    findingArchetypes,
                patient:      patients,
                scoreTuning:  organizations.scoreTuning,
                plan:         riskManagementPlans,
                category:     ruleCategories,
                encounter:    encounters,
                medication:   medications,
            })
            .from(complianceFlags)
            .leftJoin(riskRules, eq(complianceFlags.ruleId, riskRules.id))
            .leftJoin(findingArchetypes, and(
                eq(findingArchetypes.ruleId, complianceFlags.ruleId),
                eq(findingArchetypes.organizationId, orgId),
            ))
            .leftJoin(patients, eq(complianceFlags.patientId, patients.id))
            .leftJoin(organizations, eq(complianceFlags.organizationId, organizations.id))
            .leftJoin(
                riskManagementPlanComplianceFlags,
                eq(riskManagementPlanComplianceFlags.complianceFlagId, complianceFlags.id),
            )
            .leftJoin(
                riskManagementPlans,
                eq(riskManagementPlanComplianceFlags.riskManagementPlanId, riskManagementPlans.id),
            )
            .leftJoin(ruleCategories, eq(ruleCategories.id, riskRules.categoryId))
            .leftJoin(encounters, eq(complianceFlags.entityId, encounters.id))
            .leftJoin(medications, eq(complianceFlags.entityId, medications.id))
            .where(and(
                eq(complianceFlags.organizationId, orgId),
                eq(complianceFlags.instanceId, instanceId),
            ))
            .limit(1);

        if (!row) throw new NotFoundException(`Flag not found: ${instanceId}`);

        const { flag, rule, archetype, patient, scoreTuning, plan, category, encounter, medication } = row;

        const conditions = rule
            ? await db
                .select()
                .from(ruleConditions)
                .where(and(
                    eq(ruleConditions.ruleId, rule.id),
                    eq(ruleConditions.organizationId, orgId),
                ))
                .orderBy(asc(ruleConditions.order))
            : [];

        return {
            ...flag,
            patientName: patient?.name ?? null,
            patient,
            entity: flag.entityType === 'ENCOUNTER' ? encounter : medication,
            scoreTuning: (scoreTuning ?? {}) as ScoreTuning,
            rule: rule ? { ...rule, conditions, category } : null,
            findingArchetype: archetype,
            riskManagementPlan: plan,
        };
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────

    async getDashboardStats() {
        const orgId = this.orgId;

        const [avgRow] = await db
            .select({ avgScore: sql<number>`AVG(${complianceFlags.riskScore})` })
            .from(complianceFlags)
            .where(eq(complianceFlags.organizationId, orgId));

        const [topFlag] = await db
            .select()
            .from(complianceFlags)
            .where(eq(complianceFlags.organizationId, orgId))
            .orderBy(desc(complianceFlags.riskScore))
            .limit(1);

        let topFlagResult: ((typeof complianceFlags.$inferSelect) & { scoreFactors: Record<string, number> }) | null = null;
        if (topFlag) {
            const archetypeRows = topFlag.ruleId
                ? await db
                    .select({ scoreFactors: findingArchetypes.scoreFactors })
                    .from(findingArchetypes)
                    .where(and(
                        eq(findingArchetypes.organizationId, orgId),
                        eq(findingArchetypes.ruleId, topFlag.ruleId),
                    ))
                    .limit(1)
                : [];
            const archFactors = (archetypeRows[0]?.scoreFactors ?? {}) as ScoreFactors;
            const override = (topFlag.scoreFactorsOverride ?? {}) as ScoreFactors;
            const scoreFactors: Record<string, number> = {};
            for (const f of SCORE_FACTORS_META) {
                const ov = override[f.key];
                const base = ov != null ? ov : archFactors[f.key];
                if (base != null) scoreFactors[f.key] = base;
            }
            topFlagResult = { ...topFlag, scoreFactors };
        }

        const trendFlags = await db
            .select({
                instanceId: complianceFlags.instanceId,
                severity: complianceFlags.severity,
                createdAt: complianceFlags.createdAt,
            })
            .from(complianceFlags)
            .where(eq(complianceFlags.organizationId, orgId))
            .orderBy(asc(complianceFlags.createdAt));

        return {
            avgRiskScore: Number(avgRow?.avgScore ?? 0),
            topFlag: topFlagResult,
            trendFlags,
        };
    }

    // ── Table metadata (for UI condition builder) ─────────────────────────────

    getTableCatalog() {
        return Object.entries(COLUMN_REGISTRY).map(([tableId, columns]) => ({
            id: tableId,
            label: (tableId as TargetTable) === TargetTable.ENCOUNTER_ANALYTICS
                ? 'Encounter Analytics'
                : 'Medication Analytics',
            columns: Object.entries(columns).map(([fieldName, meta]) => ({
                fieldName,
                type: meta.type,
                label: meta.label,
                description: meta.description,
            })),
        }));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private validateConditionFields(
        targetTable: TargetTable,
        conditions: { fieldName: string }[],
    ) {
        const registry = COLUMN_REGISTRY[targetTable];
        if (!registry) throw new BadRequestException(`Unknown targetTable: ${targetTable}`);
        for (const c of conditions) {
            if (!(c.fieldName in registry)) {
                throw new BadRequestException(
                    `Field "${c.fieldName}" does not exist in table "${targetTable}". ` +
                    `Valid fields: ${Object.keys(registry).join(', ')}`,
                );
            }
        }
    }

    private async attachConditions(
        rules: (typeof riskRules.$inferSelect)[],
    ) {
        if (!rules.length) return [];
        const ids = rules.map((r) => r.id);
        const conds = await db
            .select()
            .from(ruleConditions)
            .where(
                and(
                    eq(ruleConditions.organizationId, this.orgId),
                    inArray(ruleConditions.ruleId, ids),
                ),
            )
            .orderBy(asc(ruleConditions.order));

        const map = new Map<string, (typeof ruleConditions.$inferSelect)[]>();
        for (const c of conds) {
            const list = map.get(c.ruleId) ?? [];
            list.push(c);
            map.set(c.ruleId, list);
        }
        return rules.map((r) => ({ ...r, conditions: map.get(r.id) ?? [] }));
    }
}
