import { Body, Controller, HttpCode, HttpException, HttpStatus, Post } from '@nestjs/common';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';
import type { auth } from '@app/common/auth';
import { RiskManagementService } from '../risk-management/risk-management.service';
import { PusherService } from './pusher.service';

@Controller()
export class PusherController {
  constructor(
    private readonly pusherService: PusherService,
    private readonly riskManagementService: RiskManagementService,
  ) {}

  @Post('pusher/auth')
  @HttpCode(HttpStatus.OK)
  async authorizeChannel(
    @Body() body: { socket_id: string; channel_name: string },
    @Session() session: UserSession<typeof auth>,
  ) {
    let authorized = false;

    authorized ||= await this.riskManagementService.isAuthorizedRMPChannel(body.channel_name);

    if (!authorized) throw new HttpException('Forbidden', 403);
    return this.pusherService.authorizeChannel(body.socket_id, body.channel_name);
  }
}
