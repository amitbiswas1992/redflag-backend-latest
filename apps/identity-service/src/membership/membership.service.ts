import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { db, members, users } from '@app/db';
import { AuditService } from '@app/common';
import { and, eq, sql } from 'drizzle-orm';

@Injectable()
export class MembershipService {
    constructor(private readonly auditService: AuditService) {}

    async listMembers(organizationId: string) {
        return db
            .select({
                membershipId: members.id,
                userId: members.userId,
                role: members.role,
                createdAt: members.createdAt,
                userEmail: users.email,
                userName: users.name,
            })
            .from(members)
            .innerJoin(users, eq(users.id, members.userId))
            .where(eq(members.organizationId, organizationId));
    }

    async kickMember(organizationId: string, targetUserId: string, actor: { userId: string; role: string }) {
        if (targetUserId === actor.userId) {
            throw new ForbiddenException('CANNOT_KICK_SELF');
        }
        const targetMembership = await db
            .select()
            .from(members)
            .where(and(eq(members.userId, targetUserId), eq(members.organizationId, organizationId)))
            .then(r => r[0]);
        if (!targetMembership) throw new NotFoundException('MEMBER_NOT_FOUND');
        if (actor.role === 'ADMIN' && targetMembership.role !== 'MEMBER') {
            throw new ForbiddenException('ADMIN_CANNOT_KICK_NON_MEMBER');
        } else if (actor.role !== 'OWNER') {
            throw new ForbiddenException('INSUFFICIENT_PRIVILEGES');
        }
        await db.delete(members).where(eq(members.id, targetMembership.id));
        await this.auditService.log({ eventType: 'MEMBER_KICKED', userId: targetUserId, organizationId, metadata: { kickedBy: actor.userId } });
        return { success: true };
    }

    async leaveOrganization(organizationId: string, userId: string) {
        const membership = await db
            .select()
            .from(members)
            .where(and(eq(members.userId, userId), eq(members.organizationId, organizationId)))
            .then(r => r[0]);
        if (!membership) throw new NotFoundException('MEMBERSHIP_NOT_FOUND');
        if (membership.role === 'OWNER') {
            const ownerCount = await db
                .select({ count: sql<number>`count(*)` })
                .from(members)
                .where(and(eq(members.organizationId, organizationId), eq(members.role, 'OWNER')))
                .then(r => Number(r[0].count));
            if (ownerCount <= 1) {
                throw new ForbiddenException('LAST_OWNER_CANNOT_LEAVE: Transfer ownership before leaving.');
            }
        }
        await db.delete(members).where(eq(members.id, membership.id));
        await this.auditService.log({ eventType: 'MEMBER_LEFT', userId, organizationId });
        return { success: true };
    }

    async transferOwnership(organizationId: string, newOwnerUserId: string, currentOwnerId: string) {
        const currentMembership = await db
            .select()
            .from(members)
            .where(and(eq(members.userId, currentOwnerId), eq(members.organizationId, organizationId), eq(members.role, 'OWNER')))
            .then(r => r[0]);
        if (!currentMembership) throw new ForbiddenException('ONLY_OWNER_CAN_TRANSFER');
        if (newOwnerUserId === currentOwnerId) throw new ForbiddenException('ALREADY_OWNER');
        const targetMembership = await db
            .select()
            .from(members)
            .where(and(eq(members.userId, newOwnerUserId), eq(members.organizationId, organizationId)))
            .then(r => r[0]);
        if (!targetMembership) throw new NotFoundException('TARGET_MEMBER_NOT_FOUND');
        await db.update(members).set({ role: 'ADMIN' }).where(eq(members.id, currentMembership.id));
        await db.update(members).set({ role: 'OWNER' }).where(eq(members.id, targetMembership.id));
        await this.auditService.log({ eventType: 'OWNERSHIP_TRANSFERRED', userId: newOwnerUserId, organizationId, metadata: { fromUserId: currentOwnerId } });
        return { success: true };
    }

    async updatePlatformRole(organizationId: string, targetUserId: string, newRole: string, actor: { userId: string; role: string }) {
        if (actor.role !== 'OWNER') throw new ForbiddenException('ONLY_OWNER_CAN_CHANGE_ROLES');
        const membership = await db.select().from(members).where(and(eq(members.userId, targetUserId), eq(members.organizationId, organizationId))).then(r => r[0]);
        if (!membership) throw new NotFoundException('MEMBER_NOT_FOUND');
        await db.update(members).set({ role: newRole }).where(eq(members.id, membership.id));
        await this.auditService.log({ eventType: 'ROLE_CHANGED', userId: targetUserId, organizationId, metadata: { newPlatformRole: newRole, changedBy: actor.userId } });
        return { success: true };
    }
}
