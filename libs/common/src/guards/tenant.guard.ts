import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
    AUTH_PUBLIC_ROUTE_KEY,
    LEGACY_ORGANIZATION_HEADER_KEY,
    REQUEST_ORGANIZATION_ID_KEY,
    REQUEST_TENANT_ID_KEY,
    TENANT_HEADER_KEY,
} from '../constants/auth.constants';

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
    constructor(private readonly reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(AUTH_PUBLIC_ROUTE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        const user = request['user'];

        if (!user) {
            throw new ForbiddenException('No user context found. Ensure InternalAuthGuard runs first.');
        }

        // Allow tenant from header override OR fallback to activeTenant in JWT
        const requestedTenantId =
            this.readHeader(request, TENANT_HEADER_KEY) ??
            this.readHeader(request, LEGACY_ORGANIZATION_HEADER_KEY) ??
            user.activeTenant;

        if (!requestedTenantId) {
            throw new ForbiddenException(`TENANT_MISSING: ${TENANT_HEADER_KEY} header is required.`);
        }

        // Verify the user actually belongs to the requested tenant
        if (!user.tenantIds?.includes(requestedTenantId)) {
            throw new ForbiddenException('TENANT_ACCESS_DENIED: You are not a member of this organization.');
        }

        // Canonical request context consumed by downstream services.
        request[REQUEST_TENANT_ID_KEY] = requestedTenantId;
        request[REQUEST_ORGANIZATION_ID_KEY] = requestedTenantId;

        return true;
    }

    private readHeader(request: Request, headerKey: string): string | undefined {
        const headerValue = request.headers[headerKey];
        if (Array.isArray(headerValue)) {
            return headerValue[0];
        }
        return headerValue;
    }
}
