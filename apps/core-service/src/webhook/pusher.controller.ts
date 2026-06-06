import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';
import type { auth } from '@app/common/auth';
import { PusherService } from './pusher.service';

@Controller()
export class PusherController {
  constructor(private readonly pusherService: PusherService) {}

  @Post('pusher/auth')
  @HttpCode(HttpStatus.OK)
  authorizeChannel(
    @Body() body: { socket_id: string; channel_name: string },
    @Session() session: UserSession<typeof auth>,
  ) {
    return this.pusherService.authorizeChannel(body.socket_id, body.channel_name, session);
  }
}
