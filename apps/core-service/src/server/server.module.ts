import { Module } from '@nestjs/common';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';
import { ClinicalModule } from '../clinical/clinical.module';
import { RiskEngineModule } from '../risk-engine/risk-engine.module';

@Module({
  imports: [ClinicalModule, RiskEngineModule],
  controllers: [ServerController],
  providers: [ServerService],
  exports: [ServerService],
})
export class ServerModule { }

