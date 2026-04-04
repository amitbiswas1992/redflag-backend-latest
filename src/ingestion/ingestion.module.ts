import { Module } from '@nestjs/common';
import { ClinicalModule } from '../clinical/clinical.module';
import { RiskEngineModule } from '../risk-engine/risk-engine.module';
import { ServerModule } from '../server/server.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { IngestionV2Controller } from './v2/ingestion-v2.controller';
import { IngestionV2Service } from './v2/ingestion-v2.service';
import { XmlParserService } from './xml-parser.service';

@Module({
  imports: [ServerModule, ClinicalModule, RiskEngineModule],
  controllers: [IngestionController, IngestionV2Controller],
  providers: [IngestionService, XmlParserService, IngestionV2Service],
  exports: [IngestionService, XmlParserService, IngestionV2Service],
})
export class IngestionModule { }

