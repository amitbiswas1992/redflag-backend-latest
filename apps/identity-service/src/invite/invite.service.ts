import { AuditService } from '@app/common';
import { db, organizations, users, invitations, members } from '@app/db';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

export interface CreateInviteDto {
    email: string;
    role: string;
}

@Injectable()
export class InviteService {
    private readonly mailgunClient: ReturnType<Mailgun['client']> | null = null;
    private readonly mailgunDomain: string;
    private readonly mailgunFrom: string;
    private readonly frontendUrl: string;

    constructor(
        private readonly jwtService: JwtService,
        private readonly auditService: AuditService,
    ) {
        const apiKey = process.env.MAILGUN_API_KEY;
        this.mailgunDomain = process.env.MAILGUN_DOMAIN ?? '';
        this.mailgunFrom = process.env.MAILGUN_FROM ?? 'chat@mg.inovetix.com';
        this.frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3002';

        if (apiKey && this.mailgunDomain) {
            const mailgun = new Mailgun(FormData);
            this.mailgunClient = mailgun.client({ username: 'api', key: apiKey });
        }
    }

    async createInvite(dto: CreateInviteDto, invitedBy: { userId: string; organizationId: string }) {
        const existing = await db.select().from(invitations)
            .where(and(eq(invitations.organizationId, invitedBy.organizationId), eq(invitations.email, dto.email), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
            .then(r => r[0]);
        if (existing) throw new BadRequestException('INVITE_ALREADY_PENDING');
        const targetUser = await db.select().from(users).where(eq(users.email, dto.email.toLowerCase())).then(r => r[0]);
        if (targetUser) {
            const existingMembership = await db.select().from(members)
                .where(and(eq(members.organizationId, invitedBy.organizationId), eq(members.userId, targetUser.id)))
                .then(r => r[0]);
            if (existingMembership) throw new BadRequestException('USER_ALREADY_MEMBER');
        }
        const org = await db.select().from(organizations).where(eq(organizations.id, invitedBy.organizationId)).then(r => r[0]);
        const jti = randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const inviteToken = await this.jwtService.signAsync(
            { type: 'invite', orgId: invitedBy.organizationId, email: dto.email, role: dto.role, jti },
            { expiresIn: '7d' },
        );
        await db.insert(invitations).values({
            organizationId: invitedBy.organizationId,
            email: dto.email,
            role: dto.role,
            inviterId: invitedBy.userId,
            expiresAt,
        });
        await this.auditService.log({ eventType: 'INVITE_SENT', userId: invitedBy.userId, organizationId: invitedBy.organizationId, metadata: { invitedEmail: dto.email, role: dto.role } });
        await this.sendInviteEmail(dto.email, org?.name ?? 'Organization', inviteToken, dto.role, expiresAt);
        return { inviteToken, expiresAt };
    }

    async resendInvite(inviteId: string, organizationId: string, invitedByUserId: string) {
        const invite = await db.select().from(invitations)
            .where(and(eq(invitations.id, inviteId), eq(invitations.organizationId, organizationId)))
            .then(r => r[0]);
        if (!invite) throw new NotFoundException('INVITE_NOT_FOUND');
        if (invite.revokedAt) throw new BadRequestException('INVITE_ALREADY_REVOKED');
        if (invite.acceptedAt) throw new BadRequestException('INVITE_ALREADY_ACCEPTED');
        const org = await db.select().from(organizations).where(eq(organizations.id, organizationId)).then(r => r[0]);
        const jti = randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const inviteToken = await this.jwtService.signAsync(
            { type: 'invite', orgId: organizationId, email: invite.email, role: invite.role, jti },
            { expiresIn: '7d' },
        );
        await db.update(invitations)
            .set({ expiresAt })
            .where(eq(invitations.id, inviteId));
        await this.auditService.log({ eventType: 'INVITE_RESENT', userId: invitedByUserId, organizationId, metadata: { invitedEmail: invite.email, role: invite.role } });
        await this.sendInviteEmail(invite.email, org?.name ?? 'Organization', inviteToken, invite.role || 'member', expiresAt);
        return { success: true };
    }

    async acceptInvite(token: string, inviteUser: { sub: string; email: string }) {
        let payload: any;
        try { payload = await this.jwtService.verifyAsync(token, { clockTolerance: 60 }); }
        catch { throw new UnauthorizedException('INVALID_INVITE_TOKEN'); }
        if (payload.type !== 'invite') throw new UnauthorizedException('INVALID_INVITE_TOKEN');
        const invite = await db.select().from(invitations).where(eq(invitations.email, inviteUser.email)).then(r => r[0]);
        if (!invite) throw new NotFoundException('INVITE_NOT_FOUND');
        if (invite.revokedAt) throw new ForbiddenException('INVITE_REVOKED');
        if (invite.acceptedAt) throw new BadRequestException('INVITE_ALREADY_ACCEPTED');
        if (new Date() > invite.expiresAt) throw new BadRequestException('INVITE_EXPIRED');
        if (payload.email.toLowerCase() !== inviteUser.email.toLowerCase()) throw new ForbiddenException('INVITE_EMAIL_MISMATCH');
        const user = await this.findOrCreateUser(inviteUser);
        await db.insert(members).values({
            userId: user.id,
            organizationId: payload.orgId,
            role: payload.role,
        }).onConflictDoNothing();
        await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, invite.id));
        await this.auditService.log({ eventType: 'INVITE_ACCEPTED', userId: user.id, organizationId: payload.orgId, metadata: { invitedBy: invite.inviterId } });
        return { success: true, organizationId: payload.orgId };
    }

    async listPendingInvites(organizationId: string) {
        return db.select().from(invitations).where(and(eq(invitations.organizationId, organizationId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)));
    }

    async revokeInvite(inviteId: string, organizationId: string, revokedByUserId: string) {
        const invite = await db.select().from(invitations).where(and(eq(invitations.id, inviteId), eq(invitations.organizationId, organizationId))).then(r => r[0]);
        if (!invite) throw new NotFoundException('INVITE_NOT_FOUND');
        if (invite.revokedAt) throw new BadRequestException('INVITE_ALREADY_REVOKED');
        if (invite.acceptedAt) throw new BadRequestException('INVITE_ALREADY_ACCEPTED');
        await db.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, inviteId));
        await this.auditService.log({ eventType: 'INVITE_REVOKED', userId: revokedByUserId, organizationId, metadata: { revokedInviteId: inviteId } });
        return { success: true };
    }

    async getInviteToken(inviteId: string, organizationId: string) {
        const invite = await db.select().from(invitations)
            .where(and(eq(invitations.id, inviteId), eq(invitations.organizationId, organizationId)))
            .then(r => r[0]);
        if (!invite) throw new NotFoundException('INVITE_NOT_FOUND');
        if (invite.revokedAt) throw new BadRequestException('INVITE_ALREADY_REVOKED');
        if (invite.acceptedAt) throw new BadRequestException('INVITE_ALREADY_ACCEPTED');
        const jti = randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const inviteToken = await this.jwtService.signAsync(
            { type: 'invite', orgId: organizationId, email: invite.email, role: invite.role, jti },
            { expiresIn: '7d' },
        );
        await db.update(invitations)
            .set({ expiresAt })
            .where(eq(invitations.id, inviteId));
        return { inviteToken, expiresAt };
    }

    private async sendInviteEmail(to: string, orgName: string, token: string, role: string, expiresAt: Date) {
        if (!this.mailgunClient || !this.mailgunDomain) {
            console.warn('[InviteService] Mailgun not configured. MAILGUN_API_KEY or MAILGUN_DOMAIN missing. Invite email not sent.');
            console.warn('[InviteService] To debug: check your .env has MAILGUN_API_KEY and MAILGUN_DOMAIN set.');
            return;
        }
        const acceptUrl = `${this.frontendUrl}/auth/accept-invite?token=${encodeURIComponent(token)}`;
        const expiresFormatted = expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        console.log(`[InviteService] Sending email via Mailgun to ${to} from domain ${this.mailgunDomain}`);
        try {
            const response = await this.mailgunClient.messages.create(this.mailgunDomain, {
                from: `Redflag <${this.mailgunFrom}>`,
                to: [to],
                subject: `You've been invited to join ${orgName} on Redflag`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                        <h2 style="color: #1a1a1a;">You're Invited!</h2>
                        <p>You've been invited to join <strong>${orgName}</strong> on Redflag as a <strong>${role}</strong>.</p>
                        <p>Click the button below to accept your invitation. This link will expire on <strong>${expiresFormatted}</strong>.</p>
                        <div style="margin: 32px 0;">
                            <a href="${acceptUrl}" style="background: #4a9b8e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Accept Invitation</a>
                        </div>
                        <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
                        <p style="color: #666; font-size: 12px; margin-top: 24px;">Or copy and paste this link: ${acceptUrl}</p>
                    </div>
                `,
                text: `You've been invited to join ${orgName} on Redflag as a ${role}. Accept your invitation here: ${acceptUrl}. This link expires on ${expiresFormatted}.`,
            });
            console.log(`[InviteService] Email sent successfully. Mailgun response:`, JSON.stringify(response));
        } catch (err: any) {
            console.error('[InviteService] FAILED to send invite email.');
            console.error('[InviteService] Error message:', err?.message ?? 'Unknown error');
            console.error('[InviteService] Error details:', JSON.stringify(err?.response?.body ?? err?.details ?? err, null, 2));
        }
    }

    private async findOrCreateUser(inviteUser: { sub: string; email: string }) {
        const existing = await db.select().from(users).where(eq(users.email, inviteUser.email)).then(r => r[0]);
        if (existing) return existing;
        const newUsers = await db.insert(users).values({ email: inviteUser.email, name: inviteUser.email }).returning();
        return newUsers[0];
    }
}
