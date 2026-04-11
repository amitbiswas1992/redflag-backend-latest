import { pgTable, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    keycloakId: text('keycloak_id').notNull().unique(), // The Global Subject (sub) from Keycloak JWT
    email: text('email').notNull().unique(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const organizationMemberships = pgTable('organization_memberships', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    role: text('role').notNull().default('MEMBER'), // OWNER, ADMIN, MEMBER
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('unq_membership').on(table.userId, table.organizationId)
]);
