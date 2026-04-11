import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { db, users, organizations, organizationMemberships } from '@app/db';
import { eq, inArray } from 'drizzle-orm';
import axios from 'axios';

export interface InternalJwtPayload {
    sub: string;
    email: string;
    keycloakId: string;
    tenantIds: string[];
    activeTenant: string;
    role: string;
}

@Injectable()
export class AuthService {
    private readonly keycloakUrl = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
    private readonly realm = process.env.KEYCLOAK_REALM ?? 'redflag-saas';
    private readonly clientId = process.env.KEYCLOAK_CLIENT_ID ?? 'redflag-web-app';
    private readonly adminClientId = 'admin-cli';
    private readonly adminUser = process.env.KEYCLOAK_ADMIN_USER ?? 'admin';
    private readonly adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'admin';

    constructor(private readonly jwtService: JwtService) { }

    /**
     * STEP 1 — Keycloak token has already been verified by KeycloakAuthGuard.
     * This method: upserts the user in DB, loads tenant memberships,
     * selects the first tenant as active, and issues an internal JWT.
     */
    async syncWithKeycloak(keycloakUser: {
        sub: string;
        email: string;
        firstName?: string;
        lastName?: string;
    }, preferredTenantId?: string): Promise<{ access_token: string; user: any; tenants: any[] }> {
        // Upsert user
        let user = await this.findUserByKeycloakId(keycloakUser.sub);
        if (!user) {
            const inserted = await db.insert(users).values({
                keycloakId: keycloakUser.sub,
                email: keycloakUser.email,
                firstName: keycloakUser.firstName,
                lastName: keycloakUser.lastName,
            }).returning();
            user = inserted[0];
        }

        // Load all tenant memberships
        const memberships = await db
            .select({
                organizationId: organizationMemberships.organizationId,
                role: organizationMemberships.role,
                org: organizations,
            })
            .from(organizationMemberships)
            .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
            .where(eq(organizationMemberships.userId, user.id));

        const tenantIds = memberships.map(m => m.organizationId);
        const tenants = memberships.map(m => ({
            id: m.org.id,
            name: m.org.name,
            slug: m.org.slug,
            role: m.role,
        }));

        // Choose active tenant
        const validPreferred = preferredTenantId && tenantIds.includes(preferredTenantId);
        const activeTenant = validPreferred ? preferredTenantId : (tenantIds[0] ?? null);
        const activeMembership = memberships.find(m => m.organizationId === activeTenant);

        const jwtPayload: InternalJwtPayload = {
            sub: user.id,
            email: user.email,
            keycloakId: user.keycloakId,
            tenantIds,
            activeTenant: activeTenant ?? '',
            role: activeMembership?.role ?? '',
        };

        const access_token = await this.jwtService.signAsync(jwtPayload);

        return {
            access_token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                activeTenant,
                role: jwtPayload.role,
            },
            tenants,
        };
    }

    /**
     * Switch the user's active tenant and issue a new internal JWT.
     * Validates the user is actually a member of the requested tenant.
     */
    async switchTenant(userId: string, tenantId: string): Promise<{ access_token: string }> {
        const membership = await db
            .select()
            .from(organizationMemberships)
            .where(eq(organizationMemberships.userId, userId))
            .then(rows => rows.find(r => r.organizationId === tenantId));

        if (!membership) {
            throw new ForbiddenException('TENANT_ACCESS_DENIED: You are not a member of this organization.');
        }

        // Reload all tenant IDs
        const allMemberships = await db
            .select({ organizationId: organizationMemberships.organizationId })
            .from(organizationMemberships)
            .where(eq(organizationMemberships.userId, userId));

        const user = await db.select().from(users).where(eq(users.id, userId)).then(r => r[0]);

        const jwtPayload: InternalJwtPayload = {
            sub: user.id,
            email: user.email,
            keycloakId: user.keycloakId,
            tenantIds: allMemberships.map(m => m.organizationId),
            activeTenant: tenantId,
            role: membership.role,
        };

        const access_token = await this.jwtService.signAsync(jwtPayload);
        return { access_token };
    }

    /**
     * Get the current authenticated user's profile and tenant list.
     */
    async getMe(userId: string): Promise<any> {
        const user = await db.select().from(users).where(eq(users.id, userId)).then(r => r[0]);
        if (!user) throw new UnauthorizedException('User not found');

        const memberships = await db
            .select({
                organizationId: organizationMemberships.organizationId,
                role: organizationMemberships.role,
                org: organizations,
            })
            .from(organizationMemberships)
            .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
            .where(eq(organizationMemberships.userId, user.id));

        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            tenants: memberships.map(m => ({
                id: m.org.id,
                name: m.org.name,
                slug: m.org.slug,
                role: m.role,
            })),
        };
    }

    // ─── Registration support (Keycloak Admin API) ────────────────────────────

    async registerWithKeycloak(email: string, password: string, firstName: string, lastName: string): Promise<void> {
        const adminToken = await this.getAdminToken();
        const usersUrl = `${this.keycloakUrl}/admin/realms/${this.realm}/users`;

        try {
            await axios.post(
                usersUrl,
                {
                    username: email, email, firstName, lastName, enabled: true, emailVerified: true,
                    credentials: [{ type: 'password', value: password, temporary: false }]
                },
                { headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' } },
            );
        } catch (err: any) {
            if (err.response?.status === 409) throw new BadRequestException('A user with this email already exists.');
            throw new BadRequestException('Registration failed. Please try again.');
        }
    }

    async loginWithKeycloak(email: string, password: string): Promise<{ access_token: string }> {
        const tokenUrl = `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token`;
        const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET ?? '';
        const params = new URLSearchParams({
            grant_type: 'password',
            client_id: this.clientId,
            username: email,
            password,
            scope: 'openid email profile',
            ...(clientSecret ? { client_secret: clientSecret } : {}),
        });

        try {
            const response = await axios.post(tokenUrl, params.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            return { access_token: response.data.access_token };
        } catch {
            throw new UnauthorizedException('Invalid email or password.');
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private async findUserByKeycloakId(keycloakId: string) {
        return db.select().from(users).where(eq(users.keycloakId, keycloakId)).then(r => r[0] ?? null);
    }

    private async getAdminToken(): Promise<string> {
        const tokenUrl = `${this.keycloakUrl}/realms/master/protocol/openid-connect/token`;
        const params = new URLSearchParams({
            grant_type: 'password',
            client_id: this.adminClientId,
            username: this.adminUser,
            password: this.adminPassword,
        });
        const response = await axios.post(tokenUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return response.data.access_token;
    }

    decodeToken(token: string): any {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        try {
            return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        } catch {
            return null;
        }
    }
}
