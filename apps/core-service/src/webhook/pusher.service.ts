import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Pusher from 'pusher';

export interface PusherCredentials {
  key: string;
  wsHost?: string;
  wsPort?: number;
  cluster?: string;
}

@Injectable()
export class PusherService {
  private readonly pusher: Pusher;
  private readonly credentials: PusherCredentials;

  constructor(config: ConfigService) {
    const publicHost = config.get<string>('PUSHER_HOST');
    const internalHost = config.get<string>('PUSHER_INTERNAL_HOST') || publicHost;
    const port = config.get<string>('PUSHER_PORT');
    const key = config.getOrThrow<string>('PUSHER_APP_KEY');

    // Returned to the frontend — uses public host so browsers can reach Soketi
    this.credentials = {
      key,
      ...(publicHost && port
        ? { wsHost: publicHost, wsPort: Number(port) }
        : { cluster: config.getOrThrow<string>('PUSHER_CLUSTER') }),
    };

    // Server SDK uses internal host — resolves inside Docker network
    this.pusher = new Pusher({
      appId: config.getOrThrow('PUSHER_APP_ID'),
      key,
      secret: config.getOrThrow('PUSHER_APP_SECRET'),
      ...(internalHost && port
        ? { host: internalHost, port }
        : { cluster: config.getOrThrow('PUSHER_CLUSTER') }),
    });
  }

  getCredentials(): PusherCredentials {
    return this.credentials;
  }

  authorizeChannel(socketId: string, channel: string) {
    return this.pusher.authorizeChannel(socketId, channel);
  }

  trigger(channel: string, event: string, data: unknown) {
    return this.pusher.trigger(channel, event, data as object);
  }
}
