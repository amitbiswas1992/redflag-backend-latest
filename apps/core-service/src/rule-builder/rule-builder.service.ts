import {
    complianceFlags,
    db,
    patients,
    riskManagementPlanComplianceFlags,
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
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import {
    CreateRiskRuleDto,
    CreateRuleCategoryDto,
    Severity,
    TargetTable,
    UpdateRiskRuleDto,
    UpdateRuleCategoryDto,
} from './dto/rule-builder.dto';
import { COLUMN_REGISTRY } from './rule-compiler.service';

type RequestContext = { organizationId?: string; tenantId?: string };

@Injectable()
export class RuleBuilderService {
    private readonly logger = new Logger(RuleBuilderService.name);

    constructor(@Inject('REQUEST') private readonly request: RequestContext) { }

    private get orgId(): string {
        const id = this.request.organizationId ?? this.request.tenantId;
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

    async listFlags(filters: { entityId?: string; ruleId?: string; severity?: string }) {
        const predicates = [eq(complianceFlags.organizationId, this.orgId)];
        if (filters.entityId) predicates.push(eq(complianceFlags.entityId, filters.entityId));
        if (filters.ruleId) predicates.push(eq(complianceFlags.ruleId, filters.ruleId));
        if (filters.severity) predicates.push(eq(complianceFlags.severity, filters.severity));

        return db
            .select()
            .from(complianceFlags)
            .where(and(...predicates))
            .orderBy(desc(complianceFlags.createdAt))
            .limit(200);
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
     * Get individual compliance flags for a specific rule with patient details.
     */
    async getFindingsDetail(ruleId: string) {
        const flags = await db
            .select({
                id: complianceFlags.id,
                entityId: complianceFlags.entityId,
                entityType: complianceFlags.entityType,
                flagType: complianceFlags.flagType,
                severity: complianceFlags.severity,
                violationContext: complianceFlags.violationContext,
                resolvedAt: complianceFlags.resolvedAt,
                createdAt: complianceFlags.createdAt,
                patientId: patients.id,
                patientName: patients.name,
                patientSourceId: patients.sourceId,
                riskManagementPlanId: riskManagementPlanComplianceFlags.riskManagementPlanId,
            })
            .from(complianceFlags)
            .leftJoin(patients, eq(complianceFlags.patientId, patients.id))
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

        return flags;
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
