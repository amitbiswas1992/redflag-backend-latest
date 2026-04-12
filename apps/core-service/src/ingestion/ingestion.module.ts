import { Module } from '@nestjs/common';
import { ClinicalModule } from '../clinical/clinical.module';
import { RiskEngineModule } from '../risk-engine/risk-engine.module';
import { ServerModule } from '../server/server.module';
import { IngestionWorkerService } from './ingestion-worker.service';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [ServerModule, ClinicalModule, RiskEngineModule],
  controllers: [IngestionController],
  providers: [IngestionService, IngestionWorkerService],
})
export class IngestionModule { }
