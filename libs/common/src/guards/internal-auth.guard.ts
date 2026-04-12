import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AUTH_PUBLIC_ROUTE_KEY } from '../constants/auth.constants';

export interface InternalJwtPayload {
    sub: string;           // Our DB user UUID
    email: string;
    keycloakId: string;
    tenantIds: string[];   // All org IDs this user belongs to
    activeTenant: string;  // Currently scoped org
    role: string;          // Role in activeTenant
    iat: number;
    exp: number;
}

/**
 * Validates the **internal** JWT issued by our backend after /auth/sync.
 * This guard does NOT accept raw Keycloak tokens — only our own signed JWTs.
 * All protected routes should use this guard.
 */
@Injectable()
export class InternalAuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(AUTH_PUBLIC_ROUTE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractToken(request);

        if (!token) {
            throw new UnauthorizedException('AUTH_MISSING_TOKEN');
        }

        try {
            const payload = await this.jwtService.verifyAsync<InternalJwtPayload>(token, {
                secret: process.env.JWT_SECRET ?? 'change-me-in-production',
            });

            // Attach full user context to request for downstream guards and services
            request['user'] = {
                id: payload.sub,
                email: payload.email,
                keycloakId: payload.keycloakId,
                tenantIds: payload.tenantIds,
                activeTenant: payload.activeTenant,
                role: payload.role,
            };

            return true;
        } catch {
            throw new UnauthorizedException('AUTH_INVALID_TOKEN');
        }
    }

    private extractToken(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
