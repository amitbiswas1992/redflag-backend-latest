import { Module } from '@nestjs/common';
import { ClinicalModule } from '../clinical/clinical.module';
import { RuleBuilderModule } from '../rule-builder/rule-builder.module';
import { ServerModule } from '../server/server.module';
import { IngestionQueueService } from './ingestion-queue.service';
import { IngestionWorkerService } from './ingestion-worker.service';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [ServerModule, ClinicalModule, RuleBuilderModule],
  controllers: [IngestionController],
  providers: [IngestionService, IngestionWorkerService, IngestionQueueService],
})
export class IngestionModule {}
