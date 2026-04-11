import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Request } from 'express';

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

        if (!requiredRoles.includes(user.role)) {
            throw new ForbiddenException(
                `ROLE_DENIED: Requires one of [${requiredRoles.join(', ')}], got [${user.role}]`
            );
        }

        return true;
    }
}
