import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { Job, JobsOptions, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { IngestionWorkerService } from './ingestion-worker.service';

export interface IngestionQueuePayload {
    jobId: string;
    organizationId: string;
}

const INGESTION_QUEUE_NAME = 'ingestion-jobs';

@Injectable()
export class IngestionQueueService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(IngestionQueueService.name);
    private readonly redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
    private readonly connection: IORedis;
    private readonly queue: Queue<IngestionQueuePayload>;
    private worker: Worker<IngestionQueuePayload> | null = null;

    constructor(private readonly ingestionWorkerService: IngestionWorkerService) {
        this.connection = new IORedis(this.redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        });

        this.queue = new Queue<IngestionQueuePayload>(INGESTION_QUEUE_NAME, {
            connection: this.connection,
        });
    }

    onModuleInit(): void {
        const concurrency = Number(process.env.INGESTION_WORKER_CONCURRENCY ?? 2);

        this.worker = new Worker<IngestionQueuePayload>(
            INGESTION_QUEUE_NAME,
            (job: Job<IngestionQueuePayload>) => this.processQueueJob(job),
            {
                connection: this.connection,
                concurrency: Number.isNaN(concurrency) ? 2 : concurrency,
            },
        );

        this.worker.on('completed', (job) => {
            this.logger.log(`Ingestion queue job completed: ${job.id}`);
        });

        this.worker.on('failed', (job, error) => {
            this.logger.error(
                `Ingestion queue job failed: ${job?.id ?? 'unknown'} - ${error.message}`,
            );
        });
    }

    async onModuleDestroy(): Promise<void> {
        if (this.worker) {
            await this.worker.close();
        }
        await this.queue.close();
        await this.connection.quit();
    }

    async enqueueIngestionJob(
        jobId: string,
        organizationId: string,
    ): Promise<string> {
        const queueJobId = `${organizationId}__${jobId}`;

        const options: JobsOptions = {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail: 200,
            jobId: queueJobId,
        };

        const queued = await this.queue.add(
            'process-ingestion-job',
            { jobId, organizationId },
            options,
        );

        return String(queued.id ?? queueJobId);
    }

    getProgress(jobId: string): {
        total: number;
        processed: number;
        status: string;
    } {
        return this.ingestionWorkerService.getProgress(jobId);
    }

    private async processQueueJob(
        job: Job<IngestionQueuePayload>,
    ): Promise<void> {
        await this.ingestionWorkerService.processQueuedJob(
            job.data.jobId,
            job.data.organizationId,
        );
    }
}
