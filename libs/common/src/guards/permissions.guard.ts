import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AUTH_PUBLIC_ROUTE_KEY } from '../constants/auth.constants';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/**
 * Enforces permission-based access control for clinical actions.
 * Reads the required permissions from the @Permissions() decorator and validates them
 * against the user's permissions array stored in the internal JWT.
 *
 * IMPORTANT: Must be used AFTER InternalAuthGuard, TenantGuard, and RolesGuard.
 *
 * @example
 * @Permissions('rules:write')
 * @UseGuards(InternalAuthGuard, TenantGuard, RolesGuard, PermissionsGuard)
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(AUTH_PUBLIC_ROUTE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // If no @Permissions() decorator is applied, allow access
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        const user = request['user'];

        if (!user?.permissions || !Array.isArray(user.permissions)) {
            throw new ForbiddenException('PERMISSION_MISSING: No permissions found in token');
        }

        const hasAllPermissions = requiredPermissions.every((perm) =>
            user.permissions.includes(perm),
        );

        if (!hasAllPermissions) {
            throw new ForbiddenException(
                `PERMISSION_DENIED: Requires [${requiredPermissions.join(', ')}], ` +
                `has [${user.permissions.join(', ')}]`
            );
        }

        return true;
    }
}
