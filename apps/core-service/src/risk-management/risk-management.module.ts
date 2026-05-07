import { Module } from '@nestjs/common';
import { RiskManagementController } from './risk-management.controller';
import { RiskManagementService } from './risk-management.service';

@Module({
    controllers: [RiskManagementController],
    providers: [RiskManagementService],
    exports: [RiskManagementService],
})
export class RiskManagementModule {}
