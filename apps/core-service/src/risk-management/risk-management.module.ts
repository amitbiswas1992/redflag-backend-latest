import { Module } from '@nestjs/common';
import { RiskManagementController } from './risk-management.controller';
import { RiskManagementService } from './risk-management.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [NotificationsModule],
    controllers: [RiskManagementController],
    providers: [RiskManagementService],
    exports: [RiskManagementService],
})
export class RiskManagementModule {}
