import { Injectable } from '@nestjs/common';
import { db, organizations, users, organizationMemberships } from '@app/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class IdentityService {

    async createOrganizationInDB(name: string, slug: string) {
        const orgs = await db.insert(organizations)
            .values({ name, slug })
            .returning();
        return orgs[0];
    }

    async ensureUserExists(keycloakId: string, email: string) {
        const existing = await db.select().from(users).where(eq(users.keycloakId, keycloakId));
        if (existing.length > 0) return existing[0];

        const newUsers = await db.insert(users)
            .values({ keycloakId, email })
            .returning();
        return newUsers[0];
    }

    async assignRole(userId: string, organizationId: string, role: string) {
        await db.insert(organizationMemberships)
            .values({ userId, organizationId, role })
            .onConflictDoNothing(); // If already member, ignore
    }
}
