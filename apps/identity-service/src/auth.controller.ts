import {
    Controller, Post, Get, Body, UseGuards, Req,
    HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { IdentityService } from './identity.service';
import { KeycloakAuthGuard } from '@app/common';
import { InternalAuthGuard } from '@app/common';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly identityService: IdentityService,
    ) { }

    /**
     * POST /auth/sync
     * Called by the frontend immediately after getting a Keycloak token.
     * Verifies the Keycloak token (via JWKS), upserts user in DB, loads tenants,
     * and returns our internal JWT.
     *
     * Body: { access_token: "keycloak_token", preferred_tenant_id?: "uuid" }
     */
    @Post('sync')
    @UseGuards(KeycloakAuthGuard)
    @HttpCode(HttpStatus.OK)
    async sync(
        @Req() req: any,
        @Body() body: { preferred_tenant_id?: string },
    ) {
        const keycloakUser = req.keycloakUser;
        return this.authService.syncWithKeycloak(keycloakUser, body.preferred_tenant_id);
    }

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

    /**
     * POST /auth/register
     * Creates a user in Keycloak via Admin API and auto-syncs them.
     * For use when NOT going through the OIDC login page (e.g. invite flow).
     */
    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    async register(@Body() body: {
        email: string;
        password: string;
        firstName?: string;
        lastName?: string;
    }) {
        await this.authService.registerWithKeycloak(
            body.email,
            body.password,
            body.firstName ?? '',
            body.lastName ?? '',
        );

        // Auto-login via ROPC to get a Keycloak token
        const { access_token: kcToken } = await this.authService.loginWithKeycloak(body.email, body.password);

        // Decode to extract Keycloak sub/email (token was just issued by us — safe)
        const payload = this.authService.decodeToken(kcToken);

        return this.authService.syncWithKeycloak({
            sub: payload.sub,
            email: payload.email,
            firstName: body.firstName,
            lastName: body.lastName,
        });
    }
}
