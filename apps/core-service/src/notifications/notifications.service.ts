import { db, notifications } from '@app/db';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { RequestContext } from '@app/common';
import { type NotificationValue } from './types';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @Inject('REQUEST') private readonly request: RequestContext,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    private get orgId(): string {
        const id = this.request.session?.session.activeOrganizationId;
        if (!id) throw new BadRequestException('Missing organizationId');
        return id;
    }

    private get userId(): string {
        const id = this.request.session?.user.id;
        if (!id) throw new BadRequestException('Missing user context');
        return id;
    }

    async listNotifications() {
        return db
            .select()
            .from(notifications)
            .where(
                and(
                    eq(notifications.userId, this.userId),
                    eq(notifications.organizationId, this.orgId),
                ),
            )
            .orderBy(desc(notifications.createdAt));
    }

    async updateStatus(ids: string[], isRead: boolean) {
        if (!ids.length) return [];
        return db
            .update(notifications)
            .set({ isRead })
            .where(
                and(
                    inArray(notifications.id, ids),
                    eq(notifications.userId, this.userId),
                ),
            )
            .returning();
    }

    async createNotification(userId: string, orgId: string, value: NotificationValue) {
        const [notification] = await db
            .insert(notifications)
            .values({
                userId,
                organizationId: orgId,
                type: value.type,
                value,
                isRead: false,
            })
            .returning();

        this.eventEmitter.emit('notification.created', { userId, orgId, notification });
        return notification;
    }

    isAuthorizedChannel(channelName: string): boolean {
        const match = channelName.match(/^private-n-(.+)_(.+)$/);
        if (!match) return false;
        try {
            return match[1] === this.userId && match[2] === this.orgId;
        } catch {
            return false;
        }
    }
}
