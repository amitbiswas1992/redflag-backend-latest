import { AuditService, InternalAuthGuard, Roles, RolesGuard } from '@app/common';
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { MembershipService } from './membership.service';

@Controller('memberships')
@UseGuards(InternalAuthGuard, RolesGuard)
export class MembershipController {
    constructor(private readonly membershipService: MembershipService, private readonly auditService: AuditService) {}

    @Get()
    @Roles('OWNER', 'ADMIN')
    async listMembers(@Req() req: any) {
        const members = await this.membershipService.listMembers(req.user.activeTenant);
        return { success: true, members };
    }

    @Delete(':userId')
    @Roles('OWNER', 'ADMIN')
    async kickMember(@Req() req: any, @Param('userId') targetUserId: string) {
        await this.membershipService.kickMember(req.user.activeTenant, targetUserId, { userId: req.user.id, role: req.user.role });
        return { success: true };
    }

    @Post('leave')
    async leaveOrganization(@Req() req: any) {
        await this.membershipService.leaveOrganization(req.user.activeTenant, req.user.id);
        return { success: true };
    }

    @Post('transfer-ownership')
    @Roles('OWNER')
    async transferOwnership(@Req() req: any, @Body('newOwnerUserId') newOwnerUserId: string) {
        await this.membershipService.transferOwnership(req.user.activeTenant, newOwnerUserId, req.user.id);
        return { success: true };
    }

    @Patch(':userId/platform-role')
    @Roles('OWNER')
    async updatePlatformRole(@Req() req: any, @Param('userId') targetUserId: string, @Body('newRole') newRole: string) {
        await this.membershipService.updatePlatformRole(req.user.activeTenant, targetUserId, newRole, { userId: req.user.id, role: req.user.role });
        return { success: true };
    }

    @Patch(':userId/functional-role')
    @Roles('OWNER', 'ADMIN')
    async updateFunctionalRole(@Req() req: any, @Param('userId') targetUserId: string, @Body('functionalRoleId') functionalRoleId: string) {
        await this.membershipService.updateFunctionalRole(req.user.activeTenant, targetUserId, functionalRoleId, { userId: req.user.id, role: req.user.role });
        return { success: true };
    }
}
