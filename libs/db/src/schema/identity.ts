import { index, pgTable, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { functionalRoles } from './rbac';

export const organizations = pgTable('organizations', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    logoUrl: text('logo_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    keycloakId: text('keycloak_id').notNull().unique(),
    email: text('email').notNull().unique(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const organizationMemberships = pgTable('organization_memberships', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    role: text('role').notNull().default('MEMBER'),
    functionalRoleId: uuid('functional_role_id').references(() => functionalRoles.id, { onDelete: 'cascade' }).notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('unq_membership').on(table.userId, table.organizationId)]);

export const authEvents = pgTable('auth_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    metadata: text('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    index('idx_auth_events_user').on(table.userId),
    index('idx_auth_events_org').on(table.organizationId),
    index('idx_auth_events_type').on(table.eventType),
    index('idx_auth_events_created').on(table.createdAt),
]);
