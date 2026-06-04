import { db, members, organizations, users } from '@app/db';
import { seedOrgRules } from '@app/db/seeders/rule-seeder';
import { InternalJwtPayload } from '@app/common';
import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq, and } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 20);

type SyncOptions = {
    preferredTenantId?: string;
    createDefaultOrgIfMissing?: boolean;
    defaultOrganizationName?: string;
};

@Injectable()
export class AuthService {
    constructor(private readonly jwtService: JwtService) {}

    async bootstrapOrganizationForUser(userId: string, organizationName: string) {
        const user = await db.select().from(users).where(eq(users.id, userId)).then(r => r[0] ?? null);
        if (!user) throw new UnauthorizedException('User not found');
        const org = await this.createOrganizationForUser(user.id, organizationName);
        const memberships = await this.getMembershipsForUser(user.id);
        const tenantIds = memberships.map(m => m.organizationId);
        const tenants = memberships.map(m => ({ id: m.org.id, name: m.org.name, slug: m.org.slug, role: m.role }));
        const access_token = await this.jwtService.signAsync({
            sub: user.id, email: user.email, tenantIds,
            activeTenant: org.id, role: 'OWNER', permissions: [], tokenVersion: 1,
        } satisfies InternalJwtPayload, { expiresIn: "1d" });
        return { access_token, activeTenant: org.id, organization: { id: org.id, name: org.name, slug: org.slug, role: 'OWNER' }, tenants, needsOrganizationSetup: false };
    }

    async switchTenant(userId: string, tenantId: string): Promise<{ access_token: string }> {
        const membership = (await db.select().from(members).where(and(eq(members.userId, userId), eq(members.organizationId, tenantId))).limit(1))?.[0];
        if (!membership) throw new ForbiddenException('TENANT_ACCESS_DENIED: You are not a member of this organization.');
        const allMemberships = await db.select({ organizationId: members.organizationId }).from(members).where(eq(members.userId, userId));
        const user = await db.select().from(users).where(eq(users.id, userId)).then(r => r[0]);
        const jwtPayload: InternalJwtPayload = {
            sub: user.id, email: user.email,
            tenantIds: allMemberships.map(m => m.organizationId),
            activeTenant: tenantId, role: membership.role,
            permissions: [], tokenVersion: 1,
        };
        const access_token = await this.jwtService.signAsync(jwtPayload, { expiresIn: "1d" });
        return { access_token };
    }

    async getMe(userId: string) {
        const user = await db.select().from(users).where(eq(users.id, userId)).then(r => r[0]);
        if (!user) throw new UnauthorizedException('User not found');
        const memberships = await db.select({ organizationId: members.organizationId, role: members.role, org: organizations })
            .from(members)
            .innerJoin(organizations, eq(organizations.id, members.organizationId))
            .where(eq(members.userId, user.id));
        return {
            id: user.id, email: user.email, name: user.name,
            tenants: memberships.map(m => ({ id: m.org.id, name: m.org.name, slug: m.org.slug, role: m.role })),
        };
    }

    private async findUserByEmail(email: string) {
        return db.select().from(users).where(eq(users.email, email)).then(r => r[0] ?? null);
    }

    private async getMembershipsForUser(userId: string) {
        return db.select({ organizationId: members.organizationId, role: members.role, org: organizations })
            .from(members)
            .innerJoin(organizations, eq(organizations.id, members.organizationId))
            .where(eq(members.userId, userId));
    }

    private async createOrganizationForUser(userId: string, organizationName: string) {
        const trimmed = organizationName?.trim();
        if (!trimmed) throw new BadRequestException('Organization name is required');
        const slug = nanoid();
        const [organization] = await db.insert(organizations).values({ name: trimmed, slug }).returning();
        await db.insert(members).values({ userId, organizationId: organization.id, role: 'OWNER' }).onConflictDoNothing();
        await seedOrgRules(organization);
        return organization;
    }

    private buildDefaultOrganizationName(user: { email: string; name?: string | null; }) {
        const name = user.name?.trim();
        if (name) return `${name} Workspace`;
        const emailPrefix = user.email?.split('@')[0] || 'Team';
        return `${emailPrefix} Workspace`;
    }

    private isUniqueViolation(err: any): boolean {
        const code = err?.code ?? err?.cause?.code;
        const message = `${err?.message ?? ''} ${err?.cause?.message ?? ''}`.toLowerCase();
        return code === '23505' || message.includes('duplicate key') || message.includes('unique');
    }

    decodeToken(token: string): any {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')); } catch { return null; }
    }
}
