import { Module } from '@nestjs/common';
import { FhirService } from './fhir.service';
import { TokenModule } from '../token/token.module';

@Module({
  imports: [TokenModule],
  providers: [FhirService],
  exports: [FhirService],
})
export class FhirModule {}
