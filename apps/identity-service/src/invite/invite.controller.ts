import { AuditService, InternalAuthGuard, Public, Roles, RolesGuard } from '@app/common';
import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InviteService } from './invite.service';

@Controller('invites')
@UseGuards(InternalAuthGuard, RolesGuard)
export class InviteController {
    constructor(private readonly inviteService: InviteService, private readonly auditService: AuditService) {}

    @Post()
    @Throttle({ invite: { limit: 20, ttl: 3600000 } })
    @Roles('OWNER', 'ADMIN')
    async createInvite(@Req() req: any, @Body() body: { email: string; platformRole: string; functionalRoleId: string }) {
        if (body.platformRole === 'OWNER' && req.user.role !== 'OWNER') {
            return { success: false, message: 'ONLY_OWNER_CAN_INVITE_OWNER' };
        }
        const result = await this.inviteService.createInvite(
            { email: body.email, platformRole: body.platformRole, functionalRoleId: body.functionalRoleId },
            { userId: req.user.id, organizationId: req.user.activeTenant },
        );
        return { success: true, ...result };
    }

    @Public()
    @Post('accept')
    async acceptInvite(@Body() body: { token: string }, @Query('keycloak_sub') keycloakSub?: string, @Query('email') email?: string) {
        const result = await this.inviteService.acceptInvite(body.token, { sub: keycloakSub ?? 'pending', email: email ?? 'pending' });
        return result;
    }

    @Get()
    @Roles('OWNER', 'ADMIN')
    async listInvites(@Req() req: any) {
        const invites = await this.inviteService.listPendingInvites(req.user.activeTenant);
        return { success: true, invites };
    }

    @Post(':id/resend')
    @Throttle({ invite: { limit: 20, ttl: 3600000 } })
    @Roles('OWNER', 'ADMIN')
    async resendInvite(@Req() req: any, @Param('id') inviteId: string) {
        const result = await this.inviteService.resendInvite(inviteId, req.user.activeTenant, req.user.id);
        return result;
    }

    @Post(':id/token')
    @Roles('OWNER', 'ADMIN')
    async getInviteToken(@Req() req: any, @Param('id') inviteId: string) {
        const result = await this.inviteService.getInviteToken(inviteId, req.user.activeTenant);
        return { success: true, ...result };
    }

    @Delete(':id')
    @Roles('OWNER', 'ADMIN')
    async revokeInvite(@Req() req: any, @Param('id') inviteId: string) {
        const result = await this.inviteService.revokeInvite(inviteId, req.user.activeTenant, req.user.id);
        return result;
    }
}
