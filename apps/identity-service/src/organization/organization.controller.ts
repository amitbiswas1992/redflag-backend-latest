import { AuditService, InternalAuthGuard, Roles, RolesGuard } from '@app/common';
import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';

@Controller('organizations')
@UseGuards(InternalAuthGuard, RolesGuard)
export class OrganizationController {
    constructor(
        private readonly organizationService: OrganizationService,
        private readonly auditService: AuditService,
    ) {}

    @Get(':id')
    @Roles('OWNER', 'ADMIN', 'MEMBER')
    async getOrganization(@Req() req: any, @Param('id') organizationId: string) {
        const org = await this.organizationService.getOrganization(organizationId);
        return { success: true, organization: org };
    }

    @Patch(':id/name')
    @Roles('OWNER', 'ADMIN')
    async updateName(
        @Req() req: any,
        @Param('id') organizationId: string,
        @Body('name') name: string,
    ) {
        const org = await this.organizationService.updateOrganizationName(
            organizationId,
            name,
            req.user.id,
        );
        return { success: true, organization: org };
    }

    @Patch(':id/logo')
    @Roles('OWNER', 'ADMIN')
    async updateLogo(
        @Req() req: any,
        @Param('id') organizationId: string,
        @Body('logoUrl') logoUrl: string,
    ) {
        const org = await this.organizationService.updateOrganizationLogo(
            organizationId,
            logoUrl,
            req.user.id,
        );
        return { success: true, organization: org };
    }
}
