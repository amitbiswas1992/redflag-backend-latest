import { Module } from '@nestjs/common';
import { FindingArchetypeController } from './finding-archetype.controller';
import { FindingArchetypeService } from './finding-archetype.service';

@Module({
    controllers: [FindingArchetypeController],
    providers: [FindingArchetypeService],
    exports: [FindingArchetypeService],
})
export class FindingArchetypeModule {}
