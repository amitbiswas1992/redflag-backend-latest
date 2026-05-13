import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { db, organizationMemberships, users, functionalRoles } from '@app/db';
import { AuditService } from '@app/common';
import { and, eq, sql } from 'drizzle-orm';

@Injectable()
export class MembershipService {
    constructor(private readonly auditService: AuditService) {}

    async listMembers(organizationId: string) {
        return db
            .select({
                membershipId: organizationMemberships.id,
                userId: organizationMemberships.userId,
                role: organizationMemberships.role,
                functionalRoleId: organizationMemberships.functionalRoleId,
                functionalRoleSlug: functionalRoles.slug,
                functionalRoleName: functionalRoles.name,
                joinedAt: organizationMemberships.joinedAt,
                userEmail: users.email,
                userFirstName: users.firstName,
                userLastName: users.lastName,
            })
            .from(organizationMemberships)
            .innerJoin(users, eq(users.id, organizationMemberships.userId))
            .innerJoin(functionalRoles, eq(functionalRoles.id, organizationMemberships.functionalRoleId))
            .where(eq(organizationMemberships.organizationId, organizationId));
    }

    async kickMember(organizationId: string, targetUserId: string, actor: { userId: string; role: string }) {
        if (targetUserId === actor.userId) {
            throw new ForbiddenException('CANNOT_KICK_SELF');
        }
        const targetMembership = await db
            .select()
            .from(organizationMemberships)
            .where(and(eq(organizationMemberships.userId, targetUserId), eq(organizationMemberships.organizationId, organizationId)))
            .then(r => r[0]);
        if (!targetMembership) throw new NotFoundException('MEMBER_NOT_FOUND');
        if (actor.role === 'ADMIN' && targetMembership.role !== 'MEMBER') {
            throw new ForbiddenException('ADMIN_CANNOT_KICK_NON_MEMBER');
        } else if (actor.role !== 'OWNER') {
            throw new ForbiddenException('INSUFFICIENT_PRIVILEGES');
        }
        await db.delete(organizationMemberships).where(eq(organizationMemberships.id, targetMembership.id));
        await this.auditService.log({ eventType: 'MEMBER_KICKED', userId: targetUserId, organizationId, metadata: { kickedBy: actor.userId } });
        return { success: true };
    }

    async leaveOrganization(organizationId: string, userId: string) {
        const membership = await db
            .select()
            .from(organizationMemberships)
            .where(and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.organizationId, organizationId)))
            .then(r => r[0]);
        if (!membership) throw new NotFoundException('MEMBERSHIP_NOT_FOUND');
        if (membership.role === 'OWNER') {
            const ownerCount = await db
                .select({ count: sql<number>`count(*)` })
                .from(organizationMemberships)
                .where(and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.role, 'OWNER')))
                .then(r => Number(r[0].count));
            if (ownerCount <= 1) {
                throw new ForbiddenException('LAST_OWNER_CANNOT_LEAVE: Transfer ownership before leaving.');
            }
        }
        await db.delete(organizationMemberships).where(eq(organizationMemberships.id, membership.id));
        await this.auditService.log({ eventType: 'MEMBER_LEFT', userId, organizationId });
        return { success: true };
    }

    async transferOwnership(organizationId: string, newOwnerUserId: string, currentOwnerId: string) {
        const currentMembership = await db
            .select()
            .from(organizationMemberships)
            .where(and(eq(organizationMemberships.userId, currentOwnerId), eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.role, 'OWNER')))
            .then(r => r[0]);
        if (!currentMembership) throw new ForbiddenException('ONLY_OWNER_CAN_TRANSFER');
        if (newOwnerUserId === currentOwnerId) throw new ForbiddenException('ALREADY_OWNER');
        const targetMembership = await db
            .select()
            .from(organizationMemberships)
            .where(and(eq(organizationMemberships.userId, newOwnerUserId), eq(organizationMemberships.organizationId, organizationId)))
            .then(r => r[0]);
        if (!targetMembership) throw new NotFoundException('TARGET_MEMBER_NOT_FOUND');
        await db.update(organizationMemberships).set({ role: 'ADMIN' }).where(eq(organizationMemberships.id, currentMembership.id));
        await db.update(organizationMemberships).set({ role: 'OWNER' }).where(eq(organizationMemberships.id, targetMembership.id));
        await this.auditService.log({ eventType: 'OWNERSHIP_TRANSFERRED', userId: newOwnerUserId, organizationId, metadata: { fromUserId: currentOwnerId } });
        return { success: true };
    }

    async updatePlatformRole(organizationId: string, targetUserId: string, newRole: string, actor: { userId: string; role: string }) {
        if (actor.role !== 'OWNER') throw new ForbiddenException('ONLY_OWNER_CAN_CHANGE_ROLES');
        const membership = await db.select().from(organizationMemberships).where(and(eq(organizationMemberships.userId, targetUserId), eq(organizationMemberships.organizationId, organizationId))).then(r => r[0]);
        if (!membership) throw new NotFoundException('MEMBER_NOT_FOUND');
        await db.update(organizationMemberships).set({ role: newRole }).where(eq(organizationMemberships.id, membership.id));
        await this.auditService.log({ eventType: 'ROLE_CHANGED', userId: targetUserId, organizationId, metadata: { newPlatformRole: newRole, changedBy: actor.userId } });
        return { success: true };
    }

    async updateFunctionalRole(organizationId: string, targetUserId: string, functionalRoleId: string, actor: { userId: string; role: string }) {
        if (!['OWNER', 'ADMIN'].includes(actor.role)) throw new ForbiddenException('INSUFFICIENT_PRIVILEGES');
        const membership = await db.select().from(organizationMemberships).where(and(eq(organizationMemberships.userId, targetUserId), eq(organizationMemberships.organizationId, organizationId))).then(r => r[0]);
        if (!membership) throw new NotFoundException('MEMBER_NOT_FOUND');
        await db.update(organizationMemberships).set({ functionalRoleId }).where(eq(organizationMemberships.id, membership.id));
        await this.auditService.log({ eventType: 'ROLE_CHANGED', userId: targetUserId, organizationId, metadata: { newFunctionalRoleId: functionalRoleId, changedBy: actor.userId } });
        return { success: true };
    }
}
