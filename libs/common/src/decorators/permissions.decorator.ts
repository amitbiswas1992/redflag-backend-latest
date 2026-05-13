import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to specify required clinical permissions for a route handler.
 * Requires PermissionsGuard to be active.
 *
 * @example
 * @Permissions('rules:write', 'rules:delete')
 * async deleteRule() { ... }
 */
export const Permissions = (...permissions: string[]) =>
    SetMetadata(PERMISSIONS_KEY, permissions);
