import {
    complianceFlags,
    db,
    riskManagementPlanAssignees,
    riskManagementPlanComplianceFlags,
    riskManagementPlans,
    users,
} from '@app/db';
import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import {
    CreateRiskManagementPlanDto,
    RiskManagementPlanType,
    RootCauseType,
    UpdateRiskManagementPlanDto,
} from './dto/risk-management.dto';

type RequestContext = { organizationId?: string; tenantId?: string };

@Injectable()
export class RiskManagementService {
    private readonly logger = new Logger(RiskManagementService.name);

    constructor(@Inject('REQUEST') private readonly request: RequestContext) {}

    private get orgId(): string {
        const id = this.request.organizationId ?? this.request.tenantId;
        if (!id) throw new BadRequestException('Missing organizationId');
        return id;
    }

    // ── Plans ─────────────────────────────────────────────────────────────────

    async createPlan(dto: CreateRiskManagementPlanDto) {
        return db.transaction(async (tx) => {
            const [plan] = await tx
                .insert(riskManagementPlans)
                .values({
                    organizationId: this.orgId,
                    riskRuleId: dto.riskRuleId ?? null,
                    title: dto.title,
                    dueDate: new Date(dto.dueDate),
                    type: dto.type ?? RiskManagementPlanType.MITIGATE,
                    rootCauseType: dto.rootCauseType,
                    impactAnalysis: dto.impactAnalysis,
                    justification: dto.justification,
                    updatedAt: new Date(),
                })
                .returning();

            if (dto.complianceFlagIds?.length) {
                await tx.insert(riskManagementPlanComplianceFlags).values(
                    dto.complianceFlagIds.map((flagId) => ({
                        riskManagementPlanId: plan.id,
                        complianceFlagId: flagId,
                    })),
                );
            }

            if (dto.assigneeIds?.length) {
                await tx.insert(riskManagementPlanAssignees).values(
                    dto.assigneeIds.map((userId) => ({
                        riskManagementPlanId: plan.id,
                        userId,
                    })),
                );
            }

            return this.attachRelations(plan, tx);
        });
    }

    async listPlans(filters: {
        page?: number;
        limit?: number;
        riskRuleId?: string;
        rootCauseType?: string;
        type?: string;
    }) {
        const page = Math.max(1, filters.page ?? 1);
        const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
        const offset = (page - 1) * limit;

        const predicates: any[] = [eq(riskManagementPlans.organizationId, this.orgId)];
        if (filters.riskRuleId)
            predicates.push(eq(riskManagementPlans.riskRuleId, filters.riskRuleId));
        if (filters.rootCauseType)
            predicates.push(
                eq(riskManagementPlans.rootCauseType, filters.rootCauseType as RootCauseType),
            );
        if (filters.type)
            predicates.push(
                eq(riskManagementPlans.type, filters.type as RiskManagementPlanType),
            );

        const where = and(...predicates);

        const [{ total }] = await db
            .select({ total: count() })
            .from(riskManagementPlans)
            .where(where);

        const plans = await db
            .select()
            .from(riskManagementPlans)
            .where(where)
            .orderBy(desc(riskManagementPlans.createdAt))
            .limit(limit)
            .offset(offset);

        const data = await Promise.all(plans.map((p) => this.attachRelations(p)));

        return { data, total: Number(total ?? 0), page, limit };
    }

    async getPlanById(id: string) {
        const [plan] = await db
            .select()
            .from(riskManagementPlans)
            .where(and(eq(riskManagementPlans.id, id), eq(riskManagementPlans.organizationId, this.orgId)));
        if (!plan) throw new NotFoundException('Risk management plan not found');
        return this.attachRelations(plan);
    }

    async updatePlan(id: string, dto: UpdateRiskManagementPlanDto) {
        return db.transaction(async (tx) => {
            const [existing] = await tx
                .select({ id: riskManagementPlans.id })
                .from(riskManagementPlans)
                .where(and(eq(riskManagementPlans.id, id), eq(riskManagementPlans.organizationId, this.orgId)))
                .limit(1);
            if (!existing) throw new NotFoundException('Risk management plan not found');

            const updateFields: Partial<typeof riskManagementPlans.$inferInsert> = {
                updatedAt: new Date(),
            };
            if (dto.title !== undefined) updateFields.title = dto.title;
            if (dto.dueDate !== undefined) updateFields.dueDate = new Date(dto.dueDate);
            if (dto.type !== undefined) updateFields.type = dto.type;
            if (dto.rootCauseType !== undefined)
                updateFields.rootCauseType = dto.rootCauseType;
            if (dto.impactAnalysis !== undefined) updateFields.impactAnalysis = dto.impactAnalysis;
            if (dto.justification !== undefined) updateFields.justification = dto.justification;
            if ('riskRuleId' in dto) updateFields.riskRuleId = dto.riskRuleId ?? null;

            const [plan] = await tx
                .update(riskManagementPlans)
                .set(updateFields)
                .where(and(eq(riskManagementPlans.id, id), eq(riskManagementPlans.organizationId, this.orgId)))
                .returning();

            if (dto.complianceFlagIds !== undefined) {
                await tx
                    .delete(riskManagementPlanComplianceFlags)
                    .where(eq(riskManagementPlanComplianceFlags.riskManagementPlanId, id));
                if (dto.complianceFlagIds.length) {
                    await tx.insert(riskManagementPlanComplianceFlags).values(
                        dto.complianceFlagIds.map((flagId) => ({
                            riskManagementPlanId: id,
                            complianceFlagId: flagId,
                        })),
                    );
                }
            }

            if (dto.assigneeIds !== undefined) {
                await tx
                    .delete(riskManagementPlanAssignees)
                    .where(eq(riskManagementPlanAssignees.riskManagementPlanId, id));
                if (dto.assigneeIds.length) {
                    await tx.insert(riskManagementPlanAssignees).values(
                        dto.assigneeIds.map((userId) => ({
                            riskManagementPlanId: id,
                            userId,
                        })),
                    );
                }
            }

            return this.attachRelations(plan, tx);
        });
    }

    async deletePlan(id: string) {
        const [deleted] = await db
            .delete(riskManagementPlans)
            .where(and(eq(riskManagementPlans.id, id), eq(riskManagementPlans.organizationId, this.orgId)))
            .returning({ id: riskManagementPlans.id });
        if (!deleted) throw new NotFoundException('Risk management plan not found');
        return { message: 'Risk management plan deleted' };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async attachRelations(
        plan: typeof riskManagementPlans.$inferSelect,
        tx: any = db,
    ) {
        const [flagLinks, assigneeLinks] = await Promise.all([
            tx
                .select({ complianceFlagId: riskManagementPlanComplianceFlags.complianceFlagId })
                .from(riskManagementPlanComplianceFlags)
                .where(eq(riskManagementPlanComplianceFlags.riskManagementPlanId, plan.id)),
            tx
                .select({ userId: riskManagementPlanAssignees.userId })
                .from(riskManagementPlanAssignees)
                .where(eq(riskManagementPlanAssignees.riskManagementPlanId, plan.id)),
        ]);

        const flagIds = flagLinks.map((l) => l.complianceFlagId);
        const userIds = assigneeLinks.map((l) => l.userId);

        const [flags, assignees] = await Promise.all([
            flagIds.length
                ? tx
                    .select({
                        id: complianceFlags.id,
                        flagType: complianceFlags.flagType,
                        severity: complianceFlags.severity,
                        entityType: complianceFlags.entityType,
                        entityId: complianceFlags.entityId,
                        createdAt: complianceFlags.createdAt,
                    })
                    .from(complianceFlags)
                    .where(inArray(complianceFlags.id, flagIds))
                : Promise.resolve([]),
            userIds.length
                ? tx
                    .select({
                        id: users.id,
                        email: users.email,
                        firstName: users.firstName,
                        lastName: users.lastName,
                    })
                    .from(users)
                    .where(inArray(users.id, userIds))
                : Promise.resolve([]),
        ]);

        return { ...plan, complianceFlags: flags, assignees };
    }
}
