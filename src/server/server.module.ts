import { Module } from '@nestjs/common';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';
import { PrismaService } from './prisma.service';
import { ClinicalModule } from '../clinical/clinical.module';

@Module({
  imports: [ClinicalModule],
  controllers: [ServerController],
  providers: [ServerService, PrismaService],
  exports: [ServerService, PrismaService],
})
export class ServerModule {}

