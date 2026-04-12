export const AUTH_PUBLIC_ROUTE_KEY = 'isPublicRoute';

export const TENANT_HEADER_KEY = 'x-tenant-id';
export const LEGACY_ORGANIZATION_HEADER_KEY = 'x-organization-id';
export const CORRELATION_ID_HEADER_KEY = 'x-correlation-id';

export const REQUEST_TENANT_ID_KEY = 'tenantId';
export const REQUEST_ORGANIZATION_ID_KEY = 'organizationId';

export const RBAC_ROLES = {
    OWNER: 'OWNER',
    ADMIN: 'ADMIN',
    MEMBER: 'MEMBER',
} as const;

export type RbacRole = (typeof RBAC_ROLES)[keyof typeof RBAC_ROLES];

export const ADMIN_ROLES: ReadonlyArray<RbacRole> = [
    RBAC_ROLES.OWNER,
    RBAC_ROLES.ADMIN,
];
