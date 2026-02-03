import { Module } from '@nestjs/common';
import { RiskEngineController } from './risk-engine.controller';
import { RiskEngineService } from './risk-engine.service';
import { PrismaService } from '../server/prisma.service';

@Module({
  controllers: [RiskEngineController],
  providers: [RiskEngineService, PrismaService],
  exports: [RiskEngineService],
})
export class RiskEngineModule {}

