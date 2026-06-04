import { LoggerService } from '@app/common';
import { Module } from '@nestjs/common';

@Module({
    providers: [LoggerService],
})
export class IdentityModule {}
