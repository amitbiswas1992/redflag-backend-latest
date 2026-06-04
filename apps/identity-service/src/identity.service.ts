import { db, organizations, users, members } from '@app/db';
import { eq } from 'drizzle-orm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class IdentityService {
    async createOrganizationInDB(name: string, slug: string) {
        const orgs = await db.insert(organizations).values({ name, slug }).returning();
        return orgs[0];
    }

    async ensureUserExists(email: string) {
        const existing = await db.select().from(users).where(eq(users.email, email));
        if (existing.length > 0) return existing[0];
        const newUsers = await db.insert(users).values({ email, name: email }).returning();
        return newUsers[0];
    }

    async assignRole(userId: string, organizationId: string, role: string) {
        await db.insert(members).values({ userId, organizationId, role }).onConflictDoNothing();
    }
}
