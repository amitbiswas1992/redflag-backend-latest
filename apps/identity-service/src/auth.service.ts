import { db, organizationMemberships, organizations, users, functionalRoles, permissions, functionalRolePermissions } from '@app/db';
import { InternalJwtPayload } from '@app/common';
import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { eq, or } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 20);

type SyncOptions = {
    preferredTenantId?: string;
    createDefaultOrgIfMissing?: boolean;
    defaultOrganizationName?: string;
};

@Injectable()
export class AuthService {
    private readonly keycloakUrl = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
    private readonly realm = process.env.KEYCLOAK_REALM ?? 'redflag-saas';
    private readonly clientId = process.env.KEYCLOAK_CLIENT_ID ?? 'redflag-web-app';
    private readonly adminClientId = 'admin-cli';
    private readonly adminUser = process.env.KEYCLOAK_ADMIN_USER ?? 'admin';
    private readonly adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'admin';

    constructor(private readonly jwtService: JwtService) {}

    async syncWithKeycloak(keycloakUser: { sub: string; email: string; firstName?: string; lastName?: string }, options: SyncOptions = {}) {
        const normalizedEmail = keycloakUser.email?.trim().toLowerCase();
        const { preferredTenantId, createDefaultOrgIfMissing = false, defaultOrganizationName } = options;
        let createdInThisSync = false;
        let user = await this.findUserByKeycloakId(keycloakUser.sub);
        if (user) {
            const [updated] = await db.update(users).set({ email: normalizedEmail || user.email, firstName: keycloakUser.firstName ?? user.firstName, lastName: keycloakUser.lastName ?? user.lastName }).where(eq(users.id, user.id)).returning();
            user = updated ?? user;
        } else {
            const byEmail = normalizedEmail ? await this.findUserByEmail(normalizedEmail) : null;
            if (byEmail) {
                const [updated] = await db.update(users).set({ keycloakId: keycloakUser.sub, email: normalizedEmail, firstName: keycloakUser.firstName ?? byEmail.firstName, lastName: keycloakUser.lastName ?? byEmail.lastName }).where(eq(users.id, byEmail.id)).returning();
                user = updated ?? byEmail;
            } else {
                try {
                    const inserted = await db.insert(users).values({ keycloakId: keycloakUser.sub, email: normalizedEmail, firstName: keycloakUser.firstName, lastName: keycloakUser.lastName }).returning();
                    user = inserted[0]; createdInThisSync = true;
                } catch (err: any) {
                    if (!this.isUniqueViolation(err)) throw err;
                    const recovered = await db.select().from(users).where(or(eq(users.keycloakId, keycloakUser.sub), eq(users.email, normalizedEmail)) as any).then(r => r[0] ?? null);
                    if (!recovered) throw err;
                    const [updated] = await db.update(users).set({ keycloakId: keycloakUser.sub, email: normalizedEmail, firstName: keycloakUser.firstName ?? recovered.firstName, lastName: keycloakUser.lastName ?? recovered.lastName }).where(eq(users.id, recovered.id)).returning();
                    user = updated ?? recovered;
                }
            }
        }
        let memberships = await this.getMembershipsForUser(user.id);
        if (memberships.length === 0 && (createDefaultOrgIfMissing || createdInThisSync)) {
            await this.createOrganizationForUser(user.id, defaultOrganizationName ?? this.buildDefaultOrganizationName(user));
            memberships = await this.getMembershipsForUser(user.id);
        }
        const tenantIds = memberships.map(m => m.organizationId);
        const tenants = memberships.map(m => ({ id: m.org.id, name: m.org.name, slug: m.org.slug, role: m.role }));
        const validPreferred = preferredTenantId && tenantIds.includes(preferredTenantId);
        // const activeTenant = validPreferred ? preferredTenantId : (tenantIds[0] ?? null);
        const activeTenant = (tenants.find(x => x.role === "MEMBER")?.id || tenantIds[0]) ?? null;
        const activeMembership = memberships.find(m => m.organizationId === activeTenant);
        const functionalRoleSlug = activeMembership?.functionalRole?.slug ?? 'compliance_officer';
        const perms = await this.getPermissionsForFunctionalRole(activeMembership?.functionalRoleId ?? '');
        const jwtPayload: InternalJwtPayload = {
            sub: user.id, email: user.email, keycloakId: user.keycloakId, tenantIds,
            activeTenant: activeTenant ?? '', role: activeMembership?.role ?? 'MEMBER',
            functionalRole: functionalRoleSlug, permissions: perms, tokenVersion: 1,
        };
        const access_token = await this.jwtService.signAsync(jwtPayload);
        const needsOrganizationSetup = tenantIds.length === 0;
        return { access_token, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, activeTenant, role: jwtPayload.role }, tenants, needsOrganizationSetup };
    }

    async bootstrapOrganizationForUser(userId: string, organizationName: string) {
        const user = await db.select().from(users).where(eq(users.id, userId)).then(r => r[0] ?? null);
        if (!user) throw new UnauthorizedException('User not found');
        const org = await this.createOrganizationForUser(user.id, organizationName);
        const memberships = await this.getMembershipsForUser(user.id);
        const tenantIds = memberships.map(m => m.organizationId);
        const tenants = memberships.map(m => ({ id: m.org.id, name: m.org.name, slug: m.org.slug, role: m.role }));
        const perms = await this.getPermissionsForFunctionalRole('00000000-0000-0000-0000-000000000001');
        const access_token = await this.jwtService.signAsync({
            sub: user.id, email: user.email, keycloakId: user.keycloakId, tenantIds,
            activeTenant: org.id, role: 'OWNER', functionalRole: 'risk_owner', permissions: perms, tokenVersion: 1,
        } satisfies InternalJwtPayload);
        return { access_token, activeTenant: org.id, organization: { id: org.id, name: org.name, slug: org.slug, role: 'OWNER' }, tenants, needsOrganizationSetup: false };
    }

    async switchTenant(userId: string, tenantId: string): Promise<{ access_token: string }> {
        const membership = await db.select().from(organizationMemberships).where(eq(organizationMemberships.userId, userId)).then(rows => rows.find(r => r.organizationId === tenantId));
        if (!membership) throw new ForbiddenException('TENANT_ACCESS_DENIED: You are not a member of this organization.');
        const allMemberships = await db.select({ organizationId: organizationMemberships.organizationId }).from(organizationMemberships).where(eq(organizationMemberships.userId, userId));
        const user = await db.select().from(users).where(eq(users.id, userId)).then(r => r[0]);
        const functionalRole = await db.select().from(functionalRoles).where(eq(functionalRoles.id, membership.functionalRoleId)).then(r => r[0]);
        const perms = await this.getPermissionsForFunctionalRole(membership.functionalRoleId);
        const jwtPayload: InternalJwtPayload = {
            sub: user.id, email: user.email, keycloakId: user.keycloakId,
            tenantIds: allMemberships.map(m => m.organizationId),
            activeTenant: tenantId, role: membership.role,
            functionalRole: functionalRole?.slug ?? 'compliance_officer',
            permissions: perms, tokenVersion: 1,
        };
        const access_token = await this.jwtService.signAsync(jwtPayload);
        return { access_token };
    }

    async getMe(userId: string): Promise<any> {
        const user = await db.select().from(users).where(eq(users.id, userId)).then(r => r[0]);
        if (!user) throw new UnauthorizedException('User not found');
        const memberships = await db.select({ organizationId: organizationMemberships.organizationId, role: organizationMemberships.role, functionalRoleId: organizationMemberships.functionalRoleId, org: organizations, functionalRole: functionalRoles })
            .from(organizationMemberships)
            .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
            .leftJoin(functionalRoles, eq(functionalRoles.id, organizationMemberships.functionalRoleId))
            .where(eq(organizationMemberships.userId, user.id));
        return {
            id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
            tenants: memberships.map(m => ({ id: m.org.id, name: m.org.name, slug: m.org.slug, role: m.role, functionalRole: m.functionalRole?.slug })),
        };
    }

    async registerWithKeycloak(email: string, password: string, firstName: string, lastName: string): Promise<void> {
        const adminToken = await this.getAdminToken();
        const usersUrl = `${this.keycloakUrl}/admin/realms/${this.realm}/users`;
        try {
            await axios.post(usersUrl, { username: email, email, firstName, lastName, enabled: true, emailVerified: true, credentials: [{ type: 'password', value: password, temporary: false }] }, { headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' } });
        } catch (err: any) {
            if (err.response?.status === 409) throw new BadRequestException('A user with this email already exists.');
            throw new BadRequestException('Registration failed. Please try again.');
        }
    }

    async loginWithKeycloak(email: string, password: string): Promise<{ access_token: string }> {
        const tokenUrl = `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token`;
        const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET ?? '';
        const params = new URLSearchParams({ grant_type: 'password', client_id: this.clientId, username: email, password, scope: 'openid email profile', ...(clientSecret ? { client_secret: clientSecret } : {}) });
        try {
            const response = await axios.post(tokenUrl, params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
            return { access_token: response.data.access_token };
        } catch { throw new UnauthorizedException('Invalid email or password.'); }
    }

    private async findUserByKeycloakId(keycloakId: string) {
        return db.select().from(users).where(eq(users.keycloakId, keycloakId)).then(r => r[0] ?? null);
    }

    private async findUserByEmail(email: string) {
        return db.select().from(users).where(eq(users.email, email)).then(r => r[0] ?? null);
    }

    private async getMembershipsForUser(userId: string) {
        return db.select({ organizationId: organizationMemberships.organizationId, role: organizationMemberships.role, functionalRoleId: organizationMemberships.functionalRoleId, org: organizations, functionalRole: functionalRoles })
            .from(organizationMemberships)
            .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
            .leftJoin(functionalRoles, eq(functionalRoles.id, organizationMemberships.functionalRoleId))
            .where(eq(organizationMemberships.userId, userId));
    }

    private async getPermissionsForFunctionalRole(functionalRoleId: string) {
        if (!functionalRoleId) return [];
        const rows = await db.select({ resource: permissions.resource, action: permissions.action })
            .from(functionalRolePermissions)
            .innerJoin(permissions, eq(permissions.id, functionalRolePermissions.permissionId))
            .where(eq(functionalRolePermissions.functionalRoleId, functionalRoleId));
        return rows.map(r => `${r.resource}:${r.action}`);
    }

    private async createOrganizationForUser(userId: string, organizationName: string) {
        const trimmed = organizationName?.trim();
        if (!trimmed) throw new BadRequestException('Organization name is required');
        const slug = nanoid();
        const [organization] = await db.insert(organizations).values({ name: trimmed, slug }).returning();
        await db.insert(organizationMemberships).values({ userId, organizationId: organization.id, role: 'OWNER', functionalRoleId: '00000000-0000-0000-0000-000000000001' }).onConflictDoNothing();
        return organization;
    }

    private buildDefaultOrganizationName(user: { email: string; firstName?: string | null; lastName?: string | null }) {
        const firstName = user.firstName?.trim();
        const lastName = user.lastName?.trim();
        if (firstName || lastName) return `${[firstName, lastName].filter(Boolean).join(' ')} Workspace`;
        const emailPrefix = user.email?.split('@')[0] || 'Team';
        return `${emailPrefix} Workspace`;
    }

    private isUniqueViolation(err: any): boolean {
        const code = err?.code ?? err?.cause?.code;
        const message = `${err?.message ?? ''} ${err?.cause?.message ?? ''}`.toLowerCase();
        return code === '23505' || message.includes('duplicate key') || message.includes('unique');
    }

    private async getAdminToken(): Promise<string> {
        const tokenUrl = `${this.keycloakUrl}/realms/master/protocol/openid-connect/token`;
        const params = new URLSearchParams({ grant_type: 'password', client_id: this.adminClientId, username: this.adminUser, password: this.adminPassword });
        const response = await axios.post(tokenUrl, params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        return response.data.access_token;
    }

    decodeToken(token: string): any {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')); } catch { return null; }
    }
}
