import { Module } from '@nestjs/common';
import { PusherController } from './pusher.controller';
import { PusherEventListener } from './pusher.listener';
import { PusherService } from './pusher.service';
import { RiskManagementModule } from '../risk-management/risk-management.module';

@Module({
  imports: [RiskManagementModule],
  controllers: [PusherController],
  providers: [PusherService, PusherEventListener],
})
export class WebhookModule {}
