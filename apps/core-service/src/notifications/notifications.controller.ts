import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationStatusDto } from './dto/notifications.dto';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly service: NotificationsService) {}

    @Get()
    list() {
        return this.service.listNotifications();
    }

    @Patch('update-status')
    @HttpCode(HttpStatus.OK)
    updateStatus(@Body() dto: UpdateNotificationStatusDto) {
        return this.service.updateStatus(dto.ids, dto.isRead);
    }
}
