import { InternalAuthGuard, KeycloakAuthGuard } from '@app/common';
import {
    Body,
    Controller,
    Get,
    HttpCode, HttpStatus,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
    ) { }

    /**
     * GET /auth/me
     * Returns the current user's profile and tenant list.
     * Uses internal JWT.
     */
    @Get('me')
    @UseGuards(InternalAuthGuard)
    async me(@Req() req: any) {
        return this.authService.getMe(req.user.id);
    }

    /**
     * POST /auth/switch-tenant
     * Issues a new internal JWT with the selected tenant as activeTenant.
     * Validates the user is actually a member of the requested org.
     *
     * Body: { tenant_id: "org-uuid" }
     */
    @Post('switch-tenant')
    @UseGuards(InternalAuthGuard)
    @HttpCode(HttpStatus.OK)
    async switchTenant(@Req() req: any, @Body() body: { tenant_id: string }) {
        return this.authService.switchTenant(req.user.id, body.tenant_id);
    }

    /**
     * POST /auth/logout
     * Stateless JWT logout — frontend should discard the token.
     * For full session invalidation, call Keycloak's end_session_endpoint.
     */
    @Post('logout')
    @UseGuards(InternalAuthGuard)
    @HttpCode(HttpStatus.OK)
    async logout() {
        // Internal JWTs are stateless. The keycloak end_session_endpoint handles
        // actual SSO session invalidation on the frontend via NextAuth signOut().
        return { success: true, message: 'Logged out successfully.' };
    }

    @Post('bootstrap-organization')
    @UseGuards(InternalAuthGuard)
    @HttpCode(HttpStatus.OK)
    async bootstrapOrganization(
        @Req() req: any,
        @Body() body: { name: string },
    ) {
        return this.authService.bootstrapOrganizationForUser(req.user.id, body.name);
    }
}
