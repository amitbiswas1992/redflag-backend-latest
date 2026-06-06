import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Pusher from 'pusher';
import type { auth } from '@app/common/auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';

@Injectable()
export class PusherService {
  private readonly pusher: Pusher;

  constructor(private readonly config: ConfigService) {
    this.pusher = new Pusher({
      appId: config.getOrThrow('SOKETI_DEFAULT_APP_ID'),
      key: config.getOrThrow('SOKETI_DEFAULT_APP_KEY'),
      secret: config.getOrThrow('SOKETI_DEFAULT_APP_SECRET'),
      cluster: 'mt1',
    });
  }

  authorizeChannel(
    socketId: string,
    channel: string,
    session: UserSession<typeof auth>,
  ) {
    return this.pusher.authorizeChannel(socketId, channel);
  }
}
