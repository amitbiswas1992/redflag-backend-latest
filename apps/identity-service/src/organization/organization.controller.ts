import { AuditService, InternalAuthGuard, Roles, RolesGuard } from '@app/common';
import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { UpdateScoreTuningDto } from './dto/organization.dto';

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
        @Body('logo') logo: string,
    ) {
        const org = await this.organizationService.updateOrganizationLogo(
            organizationId,
            logo,
            req.user.id,
        );
        return { success: true, organization: org };
    }

    @Patch(':id/score-tuning')
    @Roles('OWNER', 'ADMIN')
    async updateScoreTuning(
        @Req() req: any,
        @Param('id') organizationId: string,
        @Body() body: UpdateScoreTuningDto,
    ) {
        const org = await this.organizationService.updateOrganizationScoreTuning(
            organizationId,
            body.scoreTuning,
            req.user.id,
        );
        return { success: true, organization: org };
    }
}
