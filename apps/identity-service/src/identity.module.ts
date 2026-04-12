import { LoggerService } from '@app/common';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET ?? 'change-me-in-production',
            signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as any },
        }),
    ],
    controllers: [IdentityController, AuthController],
    providers: [IdentityService, AuthService, LoggerService],
})
export class IdentityModule { }

