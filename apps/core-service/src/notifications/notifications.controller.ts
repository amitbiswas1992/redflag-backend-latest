import { Controller, Get, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly service: NotificationsService) {}

    @Get()
    list() {
        return this.service.listNotifications();
    }

    @Patch(':id/toggle-read')
    @HttpCode(HttpStatus.OK)
    toggleIsRead(@Param('id') id: string) {
        return this.service.toggleIsRead(id);
    }
}
