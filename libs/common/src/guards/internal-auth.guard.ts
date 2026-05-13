import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AUTH_PUBLIC_ROUTE_KEY } from '../constants/auth.constants';

export interface InternalJwtPayload {
    sub: string;
    email: string;
    keycloakId: string;
    tenantIds: string[];
    activeTenant: string;
    role: string;
    functionalRole: string;
    permissions: string[];
    tokenVersion: number;
    iat?: number;
    exp?: number;
}

@Injectable()
export class InternalAuthGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService, private readonly reflector: Reflector) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(AUTH_PUBLIC_ROUTE_KEY, [context.getHandler(), context.getClass()]);
        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractToken(request);
        if (token) {
            try {
                const payload = await this.jwtService.verifyAsync<InternalJwtPayload>(token, { secret: process.env.JWT_SECRET ?? 'change-me-in-production' });
                request['user'] = { id: payload.sub, email: payload.email, keycloakId: payload.keycloakId, tenantIds: payload.tenantIds, activeTenant: payload.activeTenant, role: payload.role, functionalRole: payload.functionalRole, permissions: payload.permissions };
            } catch {
                // Invalid token on a public route: ignore so unauthenticated users can still access
                if (!isPublic) throw new UnauthorizedException('AUTH_INVALID_TOKEN');
            }
        }
        if (isPublic) return true;
        if (!token) throw new UnauthorizedException('AUTH_MISSING_TOKEN');
        if (!request['user']) throw new UnauthorizedException('AUTH_INVALID_TOKEN');
        return true;
    }

    private extractToken(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
