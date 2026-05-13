import { InternalAuthGuard, LoggerService, PermissionsGuard, RolesGuard, TenantGuard } from '@app/common';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClinicalModule } from './clinical/clinical.module';
import { ConfigModule } from './config/config.module';
import { FhirModule } from './fhir/fhir.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { RiskManagementModule } from './risk-management/risk-management.module';
import { RuleBuilderModule } from './rule-builder/rule-builder.module';
import { ServerModule } from './server/server.module';
import { TokenModule } from './token/token.module';

@Module({
  imports: [ConfigModule, JwtModule.register({ secret: process.env.JWT_SECRET ?? 'change-me-in-production', signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as any } }), TokenModule, AuthModule, FhirModule, ClinicalModule, ServerModule, RuleBuilderModule, RiskManagementModule, IngestionModule],
  controllers: [AppController],
  providers: [
    AppService, LoggerService,
    { provide: APP_GUARD, useClass: InternalAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
