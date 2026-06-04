import { db, organizations } from '@app/db';
import { AuditService } from '@app/common';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ScoreTuningDto } from './dto/organization.dto';

@Injectable()
export class OrganizationService {
    constructor(private readonly auditService: AuditService) {}

    async getOrganization(organizationId: string) {
        const org = await db.select().from(organizations).where(eq(organizations.id, organizationId)).then(r => r[0]);
        if (!org) throw new NotFoundException('ORGANIZATION_NOT_FOUND');
        return org;
    }

    async updateOrganizationName(organizationId: string, newName: string, actorUserId: string) {
        const trimmed = newName?.trim();
        if (!trimmed) throw new BadRequestException('ORGANIZATION_NAME_REQUIRED');
        if (trimmed.length > 100) throw new BadRequestException('ORGANIZATION_NAME_TOO_LONG');

        const [updated] = await db.update(organizations)
            .set({ name: trimmed })
            .where(eq(organizations.id, organizationId))
            .returning();

        await this.auditService.log({
            eventType: 'ORGANIZATION_UPDATED',
            userId: actorUserId,
            organizationId,
            metadata: { field: 'name', newValue: trimmed },
        });

        return updated;
    }

    async updateOrganizationLogo(organizationId: string, logo: string, actorUserId: string) {
        const [updated] = await db.update(organizations)
            .set({ logo: logo })
            .where(eq(organizations.id, organizationId))
            .returning();

        await this.auditService.log({
            eventType: 'ORGANIZATION_UPDATED',
            userId: actorUserId,
            organizationId,
            metadata: { field: 'logo' },
        });

        return updated;
    }

    async updateOrganizationScoreTuning(organizationId: string, scoreTuning: ScoreTuningDto, actorUserId: string) {
        const [updated] = await db.update(organizations)
            .set({ scoreTuning })
            .where(eq(organizations.id, organizationId))
            .returning();

        await this.auditService.log({
            eventType: 'ORGANIZATION_UPDATED',
            userId: actorUserId,
            organizationId,
            metadata: { field: 'scoreTuning' },
        });

        return updated;
    }
}
