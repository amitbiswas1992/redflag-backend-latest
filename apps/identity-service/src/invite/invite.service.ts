import { db, organizationInvites, organizationMemberships, users } from '@app/db';
import { AuditService } from '@app/common';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export interface CreateInviteDto {
    email: string;
    platformRole: string;
    functionalRoleId: string;
}

@Injectable()
export class InviteService {
    constructor(private readonly jwtService: JwtService, private readonly auditService: AuditService) {}

    async createInvite(dto: CreateInviteDto, invitedBy: { userId: string; organizationId: string }) {
        const existing = await db.select().from(organizationInvites)
            .where(and(eq(organizationInvites.organizationId, invitedBy.organizationId), eq(organizationInvites.email, dto.email), isNull(organizationInvites.acceptedAt), isNull(organizationInvites.revokedAt)))
            .then(r => r[0]);
        if (existing) throw new BadRequestException('INVITE_ALREADY_PENDING');
        // Check if a user with the target email is already a member of this organization
        const targetUser = await db.select().from(users).where(eq(users.email, dto.email.toLowerCase())).then(r => r[0]);
        if (targetUser) {
            const existingMembership = await db.select().from(organizationMemberships)
                .where(and(eq(organizationMemberships.organizationId, invitedBy.organizationId), eq(organizationMemberships.userId, targetUser.id)))
                .then(r => r[0]);
            if (existingMembership) throw new BadRequestException('USER_ALREADY_MEMBER');
        }
        const jti = randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const inviteToken = await this.jwtService.signAsync(
            { type: 'invite', orgId: invitedBy.organizationId, email: dto.email, platformRole: dto.platformRole, functionalRoleId: dto.functionalRoleId, jti },
            { expiresIn: '7d' },
        );
        await db.insert(organizationInvites).values({
            organizationId: invitedBy.organizationId, email: dto.email, platformRole: dto.platformRole,
            functionalRoleId: dto.functionalRoleId, invitedByUserId: invitedBy.userId, tokenJti: jti, expiresAt,
        });
        await this.auditService.log({ eventType: 'INVITE_SENT', userId: invitedBy.userId, organizationId: invitedBy.organizationId, metadata: { invitedEmail: dto.email, platformRole: dto.platformRole } });
        return { inviteToken, expiresAt };
    }

    async acceptInvite(token: string, keycloakUser: { sub: string; email: string }) {
        let payload: any;
        try { payload = await this.jwtService.verifyAsync(token, { clockTolerance: 60 }); }
        catch { throw new UnauthorizedException('INVALID_INVITE_TOKEN'); }
        if (payload.type !== 'invite') throw new UnauthorizedException('INVALID_INVITE_TOKEN');
        const invite = await db.select().from(organizationInvites).where(eq(organizationInvites.tokenJti, payload.jti)).then(r => r[0]);
        if (!invite) throw new NotFoundException('INVITE_NOT_FOUND');
        if (invite.revokedAt) throw new ForbiddenException('INVITE_REVOKED');
        if (invite.acceptedAt) throw new BadRequestException('INVITE_ALREADY_ACCEPTED');
        if (new Date() > invite.expiresAt) throw new BadRequestException('INVITE_EXPIRED');
        if (payload.email.toLowerCase() !== keycloakUser.email.toLowerCase()) throw new ForbiddenException('INVITE_EMAIL_MISMATCH');
        const user = await this.findOrCreateUser(keycloakUser);
        await db.insert(organizationMemberships).values({ userId: user.id, organizationId: payload.orgId, role: payload.platformRole, functionalRoleId: payload.functionalRoleId }).onConflictDoNothing();
        await db.update(organizationInvites).set({ acceptedAt: new Date() }).where(eq(organizationInvites.id, invite.id));
        await this.auditService.log({ eventType: 'INVITE_ACCEPTED', userId: user.id, organizationId: payload.orgId, metadata: { invitedBy: invite.invitedByUserId } });
        return { success: true, organizationId: payload.orgId };
    }

    async listPendingInvites(organizationId: string) {
        return db.select().from(organizationInvites).where(and(eq(organizationInvites.organizationId, organizationId), isNull(organizationInvites.acceptedAt), isNull(organizationInvites.revokedAt)));
    }

    async revokeInvite(inviteId: string, organizationId: string, revokedByUserId: string) {
        const invite = await db.select().from(organizationInvites).where(and(eq(organizationInvites.id, inviteId), eq(organizationInvites.organizationId, organizationId))).then(r => r[0]);
        if (!invite) throw new NotFoundException('INVITE_NOT_FOUND');
        if (invite.revokedAt) throw new BadRequestException('INVITE_ALREADY_REVOKED');
        if (invite.acceptedAt) throw new BadRequestException('INVITE_ALREADY_ACCEPTED');
        await db.update(organizationInvites).set({ revokedAt: new Date() }).where(eq(organizationInvites.id, inviteId));
        await this.auditService.log({ eventType: 'INVITE_REVOKED', userId: revokedByUserId, organizationId, metadata: { revokedInviteId: inviteId } });
        return { success: true };
    }

    private async findOrCreateUser(keycloakUser: { sub: string; email: string }) {
        const existing = await db.select().from(users).where(eq(users.keycloakId, keycloakUser.sub)).then(r => r[0]);
        if (existing) return existing;
        const newUsers = await db.insert(users).values({ keycloakId: keycloakUser.sub, email: keycloakUser.email }).returning();
        return newUsers[0];
    }
}
