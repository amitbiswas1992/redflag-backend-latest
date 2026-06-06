import { boolean, index, jsonb, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations, users } from './identity';
import { type NotificationValue, NotificationValueSchema } from '@app/common/notifications-types';

// Enum values derived from the discriminant literals of the shared zod schema
const notificationTypes = NotificationValueSchema.options.map(
    (opt) => opt.shape.type.value,
) as [string, ...string[]];

export const notificationTypeEnum = pgEnum('notification_type', notificationTypes);

export const notifications = pgTable(
    'notifications',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .references(() => users.id, { onDelete: 'cascade' })
            .notNull(),
        organizationId: uuid('organization_id')
            .references(() => organizations.id, { onDelete: 'cascade' })
            .notNull(),
        type: notificationTypeEnum('type').notNull(),
        value: jsonb('value').notNull().$type<NotificationValue>(),
        isRead: boolean('is_read').default(false).notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [
        index('idx_notifications_user').on(table.userId),
        index('idx_notifications_org').on(table.organizationId),
        index('idx_notifications_user_org').on(table.userId, table.organizationId),
        index('idx_notifications_created').on(table.createdAt),
    ],
);
