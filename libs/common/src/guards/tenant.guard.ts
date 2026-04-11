import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Ensures the request is scoped to a valid tenant that the user actually belongs to.
 * Read the tenant from `x-tenant-id` request header and cross-checks against
 * the user's `tenantIds` list attached by InternalAuthGuard.
 *
 * IMPORTANT: Must be used AFTER InternalAuthGuard.
 *
 * @example
 * @UseGuards(InternalAuthGuard, TenantGuard)
 */
@Injectable()
export class TenantGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const user = request['user'];

        if (!user) {
            throw new ForbiddenException('No user context found. Ensure InternalAuthGuard runs first.');
        }

        // Allow tenant from header override OR fallback to activeTenant in JWT
        const requestedTenantId =
            (request.headers['x-tenant-id'] as string) ?? user.activeTenant;

        if (!requestedTenantId) {
            throw new ForbiddenException('TENANT_MISSING: x-tenant-id header is required.');
        }

        // Verify the user actually belongs to the requested tenant
        if (!user.tenantIds?.includes(requestedTenantId)) {
            throw new ForbiddenException('TENANT_ACCESS_DENIED: You are not a member of this organization.');
        }

        // Inject the resolved tenantId for downstream services
        request['tenantId'] = requestedTenantId;

        return true;
    }
}
