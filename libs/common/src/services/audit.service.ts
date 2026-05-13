import { Injectable } from '@nestjs/common';
import { db, authEvents } from '@app/db';

interface AuditLogEntry {
    eventType: string;
    userId?: string;
    organizationId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
}

/**
 * AuditService logs authentication and authorization events
 * to the auth_events table for compliance and security monitoring.
 */
@Injectable()
export class AuditService {
    async log(entry: AuditLogEntry): Promise<void> {
        try {
            await db.insert(authEvents).values({
                userId: entry.userId,
                organizationId: entry.organizationId,
                eventType: entry.eventType,
                ipAddress: entry.ipAddress,
                userAgent: entry.userAgent,
                metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
            });
        } catch {
            // Fire-and-forget: never block the request path for audit logging
        }
    }
}
