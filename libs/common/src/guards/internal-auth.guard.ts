import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

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
    constructor(private readonly jwtService: JwtService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractToken(request);

        if (!token) {
            throw new UnauthorizedException('AUTH_MISSING_TOKEN');
        }

        try {
            const payload = await this.jwtService.verifyAsync<InternalJwtPayload>(token, {
                secret: process.env.JWT_SECRET,
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
