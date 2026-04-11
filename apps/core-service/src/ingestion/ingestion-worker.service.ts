import { Injectable, Logger } from '@nestjs/common';
import { db, encounters, patients, encounterAnalytics, complianceFlags } from '@app/db';
import * as csv from 'csv-parse/sync';
import * as crypto from 'crypto';

@Injectable()
export class IngestionWorkerService {
    private readonly logger = new Logger(IngestionWorkerService.name);

    // Mock progress map for Server-Sent Events (SSE)
    private readonly progressMap = new Map<string, { total: number; processed: number; status: string }>();

    /**
     * Get real-time progress for SSE emitters
     */
    getProgress(jobId: string) {
        return this.progressMap.get(jobId) || { total: 0, processed: 0, status: 'UNKNOWN' };
    }

    /**
     * Example Ingestion Job executing the 3-Layer Architecture
     */
    async processCsvUpload(jobId: string, orgId: string, fileContent: string) {
        this.logger.log(`Starting ingestion job ${jobId}`);
        this.progressMap.set(jobId, { total: 0, processed: 0, status: 'PARSING' });

        const records = csv.parse(fileContent, { columns: true, skip_empty_lines: true });
        this.progressMap.set(jobId, { total: records.length, processed: 0, status: 'PROCESSING_LAYER_1' });

        for (let i = 0; i < records.length; i++) {
            const row: any = records[i];

            // -------------------------------------------------------------
            // LAYER 1: RAW STORAGE (S3 / Supabase Storage)
            // -------------------------------------------------------------
            // Instead of hitting PostgreSQL and drastically ballooning DB storage, 
            // the flat JSON row is written immediately to highly scalable block storage:
            const storagePath = `org_${orgId}/job_${jobId}/row_${i}.json`;
            // await this.storageService.upload(storagePath, Buffer.from(JSON.stringify(row)));
            this.logger.debug(`[Layer 1 Mock] Uploaded raw record to S3 path: ${storagePath}`);

            // -------------------------------------------------------------
            // LAYER 2: CORE FHIR TRANSLATION
            // -------------------------------------------------------------
            // We lazily lookup or create standard FHIR profiles
            // (In production, this is heavily batched. Simplified for demo!)
            const patientId = crypto.randomUUID();
            await db.insert(patients).values({
                id: patientId,
                organizationId: orgId,
                sourceId: row.patient_id,
                name: [{ family: row.family_name, given: [row.given_name] }],
                gender: row.gender,
                birthDate: new Date(row.birth_date),
                extension: { race: row.race, ethnicity: row.ethnicity },
            }).onConflictDoNothing();

            const encounterId = crypto.randomUUID();
            await db.insert(encounters).values({
                id: encounterId,
                organizationId: orgId,
                sourceId: row.encounter_id,
                patientId: patientId,
                status: row.encounter_status,
                extension: { protocolApprovedBy: row.clinical_protocol_approved_by }
            }).onConflictDoNothing();

            // -------------------------------------------------------------
            // LAYER 3: COMPLIANCE PROJECTIONS / ANALYTICS
            // -------------------------------------------------------------
            // Map heavy business-logic strings to rapid Postgres Booleans
            await db.insert(encounterAnalytics).values({
                organizationId: orgId,
                encounterId: encounterId,
                isTelehealth: row.is_telehealth === 'True',
                crossStateFlag: row.cross_state_license === 'True',
                hipaaPlatformValidated: row.hipaa_compliant_platform === 'True',
                durationMinutes: parseInt(row.session_duration) || 0,
                documentationComplete: row.clinical_notes_completed === 'True',
                patientIdentityVerified: row.patient_identity_verified === 'True',
            }).onConflictDoNothing();

            // Progress tracking
            this.progressMap.set(jobId, {
                total: records.length,
                processed: i + 1,
                status: 'PROCESSING'
            });
        }

        this.progressMap.set(jobId, { total: records.length, processed: records.length, status: 'COMPLETED' });
        this.logger.log(`Completed ingestion job ${jobId}`);
    }
}
