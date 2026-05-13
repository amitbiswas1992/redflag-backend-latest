import { AuditService, LoggerService, InternalAuthGuard, RolesGuard } from '@app/common';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { InviteController } from './invite/invite.controller';
import { InviteService } from './invite/invite.service';
import { MembershipController } from './membership/membership.controller';
import { MembershipService } from './membership/membership.service';

@Module({
    imports: [
        JwtModule.register({ secret: process.env.JWT_SECRET ?? 'change-me-in-production', signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as any } }),
        ThrottlerModule.forRoot({ throttlers: [
            { name: 'default', ttl: 60000, limit: 100 },
            { name: 'auth', ttl: 60000, limit: 10 },
            { name: 'invite', ttl: 3600000, limit: 20 },
        ]}),
    ],
    controllers: [IdentityController, AuthController, InviteController, MembershipController],
    providers: [
        IdentityService, AuthService, InviteService, MembershipService, AuditService, LoggerService,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
    ],
})
export class IdentityModule {}
