import { Module } from '@nestjs/common';
import { PusherController } from './pusher.controller';
import { PusherService } from './pusher.service';

@Module({
  controllers: [PusherController],
  providers: [PusherService],
})
export class WebhookModule {}
