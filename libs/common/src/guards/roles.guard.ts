import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AUTH_PUBLIC_ROUTE_KEY } from '../constants/auth.constants';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Enforces role-based access control within a tenant.
 * Reads the required roles from the @Roles() decorator and validates them
 * against the user's role stored in the internal JWT.
 *
 * IMPORTANT: Must be used AFTER InternalAuthGuard and TenantGuard.
 *
 * @example
 * @Roles('OWNER', 'ADMIN')
 * @UseGuards(InternalAuthGuard, TenantGuard, RolesGuard)
 */
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(AUTH_PUBLIC_ROUTE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // If no @Roles() decorator is applied, allow access
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        const user = request['user'];

        if (!user?.role) {
            throw new ForbiddenException('ROLE_MISSING: No role found in token');
        }

        const normalizedUserRole = String(user.role).toUpperCase();
        const normalizedRequiredRoles = requiredRoles.map(role => String(role).toUpperCase());

        if (!normalizedRequiredRoles.includes(normalizedUserRole)) {
            throw new ForbiddenException(
                `ROLE_DENIED: Requires one of [${normalizedRequiredRoles.join(', ')}], got [${normalizedUserRole}]`
            );
        }

        return true;
    }
}
