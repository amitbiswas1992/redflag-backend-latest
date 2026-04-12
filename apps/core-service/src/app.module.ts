import { InternalAuthGuard, LoggerService, RolesGuard, TenantGuard } from '@app/common';
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
import { RiskEngineModule } from './risk-engine/risk-engine.module';
import { ServerModule } from './server/server.module';
import { TokenModule } from './token/token.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as any },
    }),
    TokenModule,
    AuthModule,
    FhirModule,
    ClinicalModule,
    ServerModule,
    RiskEngineModule,
    IngestionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LoggerService,
    {
      provide: APP_GUARD,
      useClass: InternalAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule { }
