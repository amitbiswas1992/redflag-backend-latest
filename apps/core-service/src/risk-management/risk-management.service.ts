import {
    complianceFlags,
    db,
    members,
    riskManagementPlanAssignees,
    riskManagementPlanComplianceFlags,
    riskManagementPlanMessages,
    riskManagementPlans,
    users,
} from '@app/db';
import {
    BadRequestException,
    ForbiddenException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, count, desc, eq, inArray, or } from 'drizzle-orm';
import {
    CreateRiskManagementPlanDto,
    CreateRiskManagementPlanMessageDto,
    RiskManagementPlanType,
    RootCauseType,
    UpdateRiskManagementPlanDto,
    UpdateRiskManagementPlanStatusDto,
} from './dto/risk-management.dto';
import type { RequestContext } from '@app/common';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RiskManagementService {
    private readonly logger = new Logger(RiskManagementService.name);

    constructor(
        @Inject('REQUEST') private readonly request: RequestContext,
        private readonly eventEmitter: EventEmitter2,
        private readonly notificationsService: NotificationsService,
    ) {}

    private get orgId(): string {
        const id = this.request.session?.session.activeOrganizationId;
        if (!id) throw new BadRequestException('Missing organizationId');
        return id;
    }

    private get userId(): string {
        const id = this.request.session?.user.id;
        if (!id) throw new BadRequestException('Missing user context');
        return id;
    }

    private async getIsAdminOrOwner(): Promise<boolean> {
        const [member] = await db
            .select({ role: members.role })
            .from(members)
            .where(and(eq(members.userId, this.userId), eq(members.organizationId, this.orgId)))
            .limit(1);
        const role = member?.role;
        return role === 'admin' || role === 'owner';
    }

    // ── Plans ─────────────────────────────────────────────────────────────────

    async createPlan(dto: CreateRiskManagementPlanDto) {
        const creatorId = this.userId;
        const orgId = this.orgId;

        const result = await db.transaction(async (tx) => {
            const [plan] = await tx
                .insert(riskManagementPlans)
                .values({
                    organizationId: orgId,
                    riskRuleId: dto.riskRuleId ?? null,
                    createdBy: creatorId,
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

        if (dto.assigneeIds?.length) {
            void this.sendAssignmentNotifications(result.id, result.title, creatorId, orgId, dto.assigneeIds);
        }

        return result;
    }

    private async sendAssignmentNotifications(
        planId: string,
        planTitle: string,
        creatorId: string,
        orgId: string,
        assigneeIds: string[],
    ) {
        try {
            const [creator] = await db
                .select({ name: users.name })
                .from(users)
                .where(eq(users.id, creatorId))
                .limit(1);
            const assignedByName = creator?.name ?? 'Someone';

            for (const assigneeId of assigneeIds) {
                await this.notificationsService.createNotification(assigneeId, orgId, {
                    type: 'rmp_assignment',
                    planId,
                    planTitle,
                    assignedByUserId: creatorId,
                    assignedByName,
                    link: `/risk-management/${planId}`,
                });
            }
        } catch (err) {
            this.logger.error('Failed to send assignment notifications', err);
        }
    }

    async listPlans(filters: {
        page?: number;
        limit?: number;
        riskRuleId?: string;
        rootCauseType?: string;
        type?: string;
        status?: string;
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
        if (filters.status)
            predicates.push(
                eq(riskManagementPlans.status, filters.status as any),
            );

        // Non-admin users only see plans they created or are assigned to
        if (!await this.getIsAdminOrOwner()) {
            const uid = this.userId;
            const assignedPlanIds = await db
                .select({ riskManagementPlanId: riskManagementPlanAssignees.riskManagementPlanId })
                .from(riskManagementPlanAssignees)
                .where(eq(riskManagementPlanAssignees.userId, uid));
            const assignedIds = assignedPlanIds.map((r) => r.riskManagementPlanId);

            predicates.push(
                or(
                    eq(riskManagementPlans.createdBy, uid),
                    ...(assignedIds.length ? [inArray(riskManagementPlans.id, assignedIds)] : []),
                )!,
            );
        }

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
        const hasAccess = await this.canAccessPlan(id);
        if (!hasAccess) throw new ForbiddenException('Access denied to this risk management plan');
        return this.attachRelations(plan);
    }

    async updatePlan(id: string, dto: UpdateRiskManagementPlanDto) {
        return db.transaction(async (tx) => {
            const [existing] = await tx
                .select()
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

    async updatePlanStatus(id: string, dto: UpdateRiskManagementPlanStatusDto) {
        const uid = this.userId;
        const orgId = this.orgId;

        const [assignee] = await db
            .select({ userId: riskManagementPlanAssignees.userId })
            .from(riskManagementPlanAssignees)
            .where(
                and(
                    eq(riskManagementPlanAssignees.riskManagementPlanId, id),
                    eq(riskManagementPlanAssignees.userId, uid),
                ),
            )
            .limit(1);
        if (!assignee) throw new ForbiddenException('Only assignees can update the plan status');

        const [plan] = await db
            .update(riskManagementPlans)
            .set({ status: dto.status, updatedAt: new Date() })
            .where(and(eq(riskManagementPlans.id, id), eq(riskManagementPlans.organizationId, orgId)))
            .returning();
        if (!plan) throw new NotFoundException('Risk management plan not found');

        return this.attachRelations(plan);
    }

    async deletePlan(id: string) {
        const [deleted] = await db
            .delete(riskManagementPlans)
            .where(and(eq(riskManagementPlans.id, id), eq(riskManagementPlans.organizationId, this.orgId)))
            .returning({ id: riskManagementPlans.id });
        if (!deleted) throw new NotFoundException('Risk management plan not found');
        return { message: 'Risk management plan deleted' };
    }

    // ── Messages ──────────────────────────────────────────────────────────────

    async listMessages(planId: string) {
        const plan = await this.getPlanById(planId);

        const messages = await db
            .select({
                id: riskManagementPlanMessages.id,
                riskManagementPlanId: riskManagementPlanMessages.riskManagementPlanId,
                createdBy: riskManagementPlanMessages.createdBy,
                text: riskManagementPlanMessages.text,
                createdAt: riskManagementPlanMessages.createdAt,
            })
            .from(riskManagementPlanMessages)
            .where(eq(riskManagementPlanMessages.riskManagementPlanId, planId))
            .orderBy(riskManagementPlanMessages.createdAt);

        const creatorIds = [...new Set(messages.map((m) => m.createdBy).filter(Boolean) as string[])];
        const senders = creatorIds.length
            ? await db
                .select({ id: users.id, email: users.email, name: users.name })
                .from(users)
                .where(inArray(users.id, creatorIds))
            : [];

        const senderMap = Object.fromEntries(senders.map((s) => [s.id, s]));

        return messages.map((m) => ({ ...m, sender: m.createdBy ? senderMap[m.createdBy] ?? null : null }));
    }

    async createMessage(planId: string, dto: CreateRiskManagementPlanMessageDto) {
        const hasAccess = await this.canAccessPlan(planId);
        if (!hasAccess) throw new ForbiddenException('Access denied to this risk management plan');

        const uid = this.userId;
        const orgId = this.orgId;

        const result = await db.transaction(async (tx) => {
            const [plan] = await tx
                .select()
                .from(riskManagementPlans)
                .where(and(eq(riskManagementPlans.id, planId), eq(riskManagementPlans.organizationId, orgId)))
                .limit(1);
            if (!plan) throw new NotFoundException('Risk management plan not found');

            const isCreator = plan.createdBy === uid;

            const [message] = await tx
                .insert(riskManagementPlanMessages)
                .values({ riskManagementPlanId: planId, createdBy: uid, text: dto.text })
                .returning();

            // Update plan status based on who is sending
            const newStatus = isCreator ? 'query_answered' : 'need_more_info';
            await tx
                .update(riskManagementPlans)
                .set({ status: newStatus, updatedAt: new Date() })
                .where(eq(riskManagementPlans.id, planId));

            const [sender] = await tx
                .select({ id: users.id, email: users.email, name: users.name })
                .from(users)
                .where(eq(users.id, uid));

            return { message: { ...message, sender: sender ?? null }, plan, isCreator };
        });

        this.eventEmitter.emit('rmp.message.created', { planId, message: result.message });

        void this.sendMessageNotifications(
            planId,
            result.plan.title,
            result.plan.createdBy,
            uid,
            result.message.sender?.name ?? 'Someone',
            dto.text,
            result.isCreator,
            orgId,
        );

        return result.message;
    }

    private async sendMessageNotifications(
        planId: string,
        planTitle: string,
        creatorId: string | null,
        senderId: string,
        senderName: string,
        text: string,
        isCreator: boolean,
        orgId: string,
    ) {
        try {
            const value = {
                type: 'rmp_message' as const,
                planId,
                planTitle,
                senderUserId: senderId,
                senderName,
                messagePreview: text.slice(0, 100),
                link: `/risk-management/${planId}`,
            };

            if (isCreator) {
                const assignees = await db
                    .select({ userId: riskManagementPlanAssignees.userId })
                    .from(riskManagementPlanAssignees)
                    .where(eq(riskManagementPlanAssignees.riskManagementPlanId, planId));
                for (const { userId } of assignees) {
                    await this.notificationsService.createNotification(userId, orgId, value);
                }
            } else if (creatorId) {
                await this.notificationsService.createNotification(creatorId, orgId, value);
            }
        } catch (err) {
            this.logger.error('Failed to send message notifications', err);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    async canAccessPlan(planId: string): Promise<boolean> {
        if (await this.getIsAdminOrOwner()) return true;
        const uid = this.userId;

        const [plan] = await db
            .select({ createdBy: riskManagementPlans.createdBy })
            .from(riskManagementPlans)
            .where(and(eq(riskManagementPlans.id, planId), eq(riskManagementPlans.organizationId, this.orgId)))
            .limit(1);
        if (!plan) return false;
        if (plan.createdBy === uid) return true;

        const [assignee] = await db
            .select({ userId: riskManagementPlanAssignees.userId })
            .from(riskManagementPlanAssignees)
            .where(
                and(
                    eq(riskManagementPlanAssignees.riskManagementPlanId, planId),
                    eq(riskManagementPlanAssignees.userId, uid),
                ),
            )
            .limit(1);
        return !!assignee;
    }

    async isAuthorizedRMPChannel(channelName: string): Promise<boolean> {
        const match = channelName.match(/^private-rmp-(.+)$/);
        if (!match) return false;
        return this.canAccessPlan(match[1]);
    }

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
                        instanceId: complianceFlags.instanceId,
                    })
                    .from(complianceFlags)
                    .where(inArray(complianceFlags.id, flagIds))
                : Promise.resolve([]),
            userIds.length
                ? tx
                    .select({
                        id: users.id,
                        email: users.email,
                        name: users.name,
                    })
                    .from(users)
                    .where(inArray(users.id, userIds))
                : Promise.resolve([]),
        ]);

        return { ...plan, complianceFlags: flags, assignees };
    }
}
