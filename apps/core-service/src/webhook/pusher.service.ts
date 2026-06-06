import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Pusher from 'pusher';

@Injectable()
export class PusherService {
  private readonly pusher: Pusher;

  constructor(config: ConfigService) {
    this.pusher = new Pusher({
      appId: config.getOrThrow('SOKETI_DEFAULT_APP_ID'),
      key: config.getOrThrow('SOKETI_DEFAULT_APP_KEY'),
      secret: config.getOrThrow('SOKETI_DEFAULT_APP_SECRET'),
      cluster: 'mt1',
    });
  }

  authorizeChannel(socketId: string, channel: string) {
    return this.pusher.authorizeChannel(socketId, channel);
  }

  trigger(channel: string, event: string, data: unknown) {
    return this.pusher.trigger(channel, event, data as object);
  }
}
