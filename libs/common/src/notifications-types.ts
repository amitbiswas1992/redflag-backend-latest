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

export const RMPUpdateRequestValueSchema = z.object({
    type: z.literal('rmp_update_request'),
    planId: z.uuid(),
    planTitle: z.string(),
    requestedByUserId: z.uuid(),
    requestedByName: z.string(),
    link: z.string(),
});

export const RMPUpdateReviewedValueSchema = z.object({
    type: z.literal('rmp_update_reviewed'),
    planId: z.uuid(),
    planTitle: z.string(),
    reviewedByUserId: z.uuid(),
    reviewedByName: z.string(),
    reviewStatus: z.enum(['approved', 'rejected']),
    reviewNote: z.string().nullable(),
    link: z.string(),
});

export const NotificationValueSchema = z.discriminatedUnion('type', [
    RMPAssignmentValueSchema,
    RMPMessageValueSchema,
    RMPUpdateRequestValueSchema,
    RMPUpdateReviewedValueSchema,
]);

export type RMPAssignmentValue = z.infer<typeof RMPAssignmentValueSchema>;
export type RMPMessageValue = z.infer<typeof RMPMessageValueSchema>;
export type RMPUpdateRequestValue = z.infer<typeof RMPUpdateRequestValueSchema>;
export type RMPUpdateReviewedValue = z.infer<typeof RMPUpdateReviewedValueSchema>;
export type NotificationValue = z.infer<typeof NotificationValueSchema>;

export interface Notification {
    id: string;
    userId: string;
    organizationId: string;
    type: 'rmp_assignment' | 'rmp_message' | 'rmp_update_request' | 'rmp_update_reviewed';
    value: NotificationValue;
    isRead: boolean;
    createdAt: string;
}
