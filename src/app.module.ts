import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { TokenModule } from './token/token.module';
import { AuthModule } from './auth/auth.module';
import { FhirModule } from './fhir/fhir.module';
import { ClinicalModule } from './clinical/clinical.module';
import { ServerModule } from './server/server.module';

@Module({
  imports: [
    ConfigModule,
    TokenModule,
    AuthModule,
    FhirModule,
    ClinicalModule,
    ServerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
