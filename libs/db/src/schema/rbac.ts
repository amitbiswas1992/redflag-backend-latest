import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { organizations, users } from './identity';

// ── Permissions ──────────────────────────────────────────────────────────────
// System-wide permission registry for clinical/feature-level actions.
// Platform actions (kick member, delete org) are handled by @Roles() guard.

export const permissions = pgTable(
    'permissions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        resource: text('resource').notNull(),   // e.g., "patients"
        action: text('action').notNull(),       // e.g., "read", "write", "delete"
        description: text('description'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex('unq_permission_resource_action').on(table.resource, table.action),
    ],
);

// ── Functional Roles ─────────────────────────────────────────────────────────
// The 4 Accountability Framework roles.
// Immutable system rows with fixed UUIDs.

export const functionalRoles = pgTable(
    'functional_roles',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull(),           // e.g., "Compliance Officer"
        slug: text('slug').notNull().unique(),  // e.g., "compliance_officer"
        description: text('description'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
);

// ── Functional Role Permissions ──────────────────────────────────────────────
// Many-to-many: Functional Role <-> Permission

export const functionalRolePermissions = pgTable(
    'functional_role_permissions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        functionalRoleId: uuid('functional_role_id')
            .references(() => functionalRoles.id, { onDelete: 'cascade' })
            .notNull(),
        permissionId: uuid('permission_id')
            .references(() => permissions.id, { onDelete: 'cascade' })
            .notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex('unq_func_role_permission').on(table.functionalRoleId, table.permissionId),
    ],
);

// ── Organization Invites ─────────────────────────────────────────────────────
// Pending invites. The actual token is a signed JWT sent via email.
// Carries BOTH a platform role and a functional role.

export const organizationInvites = pgTable(
    'organization_invites',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        organizationId: uuid('organization_id')
            .references(() => organizations.id, { onDelete: 'cascade' })
            .notNull(),
        email: text('email').notNull(),
        platformRole: text('platform_role').notNull().default('MEMBER'), // OWNER, ADMIN, MEMBER
        functionalRoleId: uuid('functional_role_id')
            .references(() => functionalRoles.id, { onDelete: 'cascade' })
            .notNull(),
        invitedByUserId: uuid('invited_by_user_id')
            .references(() => users.id, { onDelete: 'cascade' })
            .notNull(),
        tokenJti: text('token_jti').notNull().unique(),
        expiresAt: timestamp('expires_at').notNull(),
        acceptedAt: timestamp('accepted_at'),
        revokedAt: timestamp('revoked_at'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [
        index('idx_invites_org').on(table.organizationId),
        index('idx_invites_email').on(table.email),
        index('idx_invites_token').on(table.tokenJti),
        uniqueIndex('unq_invite_org_email').on(table.organizationId, table.email),
    ],
);
