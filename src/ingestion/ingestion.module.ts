import { Module } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { XmlParserService } from './xml-parser.service';
import { ServerModule } from '../server/server.module';
import { ClinicalModule } from '../clinical/clinical.module';
import { RiskEngineModule } from '../risk-engine/risk-engine.module';

@Module({
  imports: [ServerModule, ClinicalModule, RiskEngineModule],
  controllers: [IngestionController],
  providers: [IngestionService, XmlParserService],
  exports: [IngestionService, XmlParserService],
})
export class IngestionModule {}

