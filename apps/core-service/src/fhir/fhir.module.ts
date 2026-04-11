import { Module } from '@nestjs/common';
import { FhirService } from './fhir.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [FhirService],
  exports: [FhirService],
})
export class FhirModule {}
