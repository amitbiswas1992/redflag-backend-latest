import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { KeycloakAuthGuard } from '@app/common';

@Controller('organizations')
export class IdentityController {
    constructor(private readonly identityService: IdentityService) { }

    @Post()
    @UseGuards(KeycloakAuthGuard)
    async createOrganization(
        @Req() req: any,
        @Body() body: { name: string; slug: string; adminEmail: string }
    ) {
        const validEmail = req.keycloakUser.email || body.adminEmail;

        // 1. Create the workspace in our multi-tenant Database
        const org = await this.identityService.createOrganizationInDB(body.name, body.slug);

        // 2. Ensure user exists
        const user = await this.identityService.ensureUserExists(validEmail);

        // 3. Make user OWNER of the new workspace
        await this.identityService.assignRole(user.id, org.id, 'OWNER');

        return { success: true, organization: org };
    }

    @Post('users')
    @UseGuards(KeycloakAuthGuard)
    async registerUser(@Req() req: any) {
        const validEmail = req.keycloakUser.email;

        const user = await this.identityService.ensureUserExists(validEmail);

        return { success: true, user };
    }
}
