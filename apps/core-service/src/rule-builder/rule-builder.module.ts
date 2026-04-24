import { Module } from '@nestjs/common';
import { RuleBuilderController } from './rule-builder.controller';
import { RuleBuilderService } from './rule-builder.service';
import { RuleCompilerService } from './rule-compiler.service';
import { RuleEvaluatorService } from './rule-evaluator.service';

@Module({
    controllers: [RuleBuilderController],
    providers: [RuleBuilderService, RuleCompilerService, RuleEvaluatorService],
    exports: [RuleEvaluatorService],
})
export class RuleBuilderModule {}
