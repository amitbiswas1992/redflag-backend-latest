import { Module } from '@nestjs/common';
import { RiskEngineController } from './risk-engine.controller';
import { RiskEngineService } from './risk-engine.service';

@Module({
  controllers: [RiskEngineController],
  providers: [RiskEngineService],
  exports: [RiskEngineService],
})
export class RiskEngineModule { }

