import { z } from 'zod';

export const RMPAssignmentValueSchema = z.object({
    type: z.literal('rmp_assignment'),
    planId: z.uuid(),
    planTitle: z.string(),
    assignedByUserId: z.uuid(),
    assignedByName: z.string(),
    link: z.string(),
});

export const RMPMessageValueSchema = z.object({
    type: z.literal('rmp_message'),
    planId: z.uuid(),
    planTitle: z.string(),
    senderUserId: z.uuid(),
    senderName: z.string(),
    messagePreview: z.string(),
    link: z.string(),
});

export const NotificationValueSchema = z.discriminatedUnion('type', [
    RMPAssignmentValueSchema,
    RMPMessageValueSchema,
]);

export type RMPAssignmentValue = z.infer<typeof RMPAssignmentValueSchema>;
export type RMPMessageValue = z.infer<typeof RMPMessageValueSchema>;
export type NotificationValue = z.infer<typeof NotificationValueSchema>;

export interface Notification {
    id: string;
    userId: string;
    organizationId: string;
    type: 'rmp_assignment' | 'rmp_message';
    value: NotificationValue;
    isRead: boolean;
    createdAt: string;
}
