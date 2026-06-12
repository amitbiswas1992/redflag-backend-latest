import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Pusher from 'pusher';

@Injectable()
export class PusherService {
  private readonly pusher: Pusher;

  constructor(config: ConfigService) {
    const host = config.get<string>('PUSHER_HOST');
    const port = config.get<string>('PUSHER_PORT');

    this.pusher = new Pusher({
      appId: config.getOrThrow('PUSHER_APP_ID'),
      key: config.getOrThrow('PUSHER_APP_KEY'),
      secret: config.getOrThrow('PUSHER_APP_SECRET'),
      ...(host && port
        ? { host, port }
        : { cluster: config.getOrThrow('PUSHER_CLUSTER') }),
    });
  }

  authorizeChannel(socketId: string, channel: string) {
    return this.pusher.authorizeChannel(socketId, channel);
  }

  trigger(channel: string, event: string, data: unknown) {
    return this.pusher.trigger(channel, event, data as object);
  }
}
