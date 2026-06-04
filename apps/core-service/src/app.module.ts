import { LoggerService } from '@app/common';
import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClinicalModule } from './clinical/clinical.module';
import { ConfigModule } from './config/config.module';
import { FhirModule } from './fhir/fhir.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { FindingArchetypeModule } from './finding-archetype/finding-archetype.module';
import { RiskManagementModule } from './risk-management/risk-management.module';
import { LlmModule } from './llm/llm.module';
import { RuleBuilderModule } from './rule-builder/rule-builder.module';
import { ServerModule } from './server/server.module';
import { TokenModule } from './token/token.module';
import { auth } from '@app/common/auth';

@Module({
  imports: [
    ConfigModule,
    TokenModule,
    AuthModule.forRoot({
      auth,
      bodyParser: {
        json: { limit: "2mb" },
        urlencoded: { limit: "2mb", extended: true },
        rawBody: true,
      },
    }),
    FhirModule,
    ClinicalModule,
    ServerModule,
    RuleBuilderModule,
    RiskManagementModule,
    IngestionModule,
    FindingArchetypeModule,
    LlmModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LoggerService,
  ],
})
export class AppModule {}
