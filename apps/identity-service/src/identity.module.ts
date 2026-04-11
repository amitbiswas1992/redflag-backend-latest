import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET ?? 'change-me-in-production',
            signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as any },
        }),
    ],
    controllers: [IdentityController, AuthController],
    providers: [IdentityService, AuthService],
})
export class IdentityModule { }

