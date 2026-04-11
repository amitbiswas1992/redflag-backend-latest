import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles on a controller or route handler.
 * Used together with RolesGuard.
 *
 * @example
 * @Roles('OWNER', 'ADMIN')
 * @UseGuards(InternalAuthGuard, TenantGuard, RolesGuard)
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
