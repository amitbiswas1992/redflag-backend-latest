import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PusherService } from './pusher.service';

@Injectable()
export class PusherEventListener {
  constructor(private readonly pusherService: PusherService) {}

  @OnEvent('rmp.message.created')
  handleMessageCreated(payload: { planId: string; message: unknown }) {
    void this.pusherService.trigger(`private-rmp-${payload.planId}`, 'new-message', payload.message);
  }
}
