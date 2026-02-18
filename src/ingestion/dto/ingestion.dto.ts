import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class IngestFhirJsonDto {
  @ApiProperty({
    description: 'FHIR resource or bundle in JSON format',
    example: {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: 'example-patient-id',
            name: [
              {
                family: 'Doe',
                given: ['John'],
              },
            ],
            birthDate: '1990-01-01',
            gender: 'male',
          },
        },
      ],
    },
  })
  @IsObject()
  @IsNotEmpty()
  fhirData: any;
}

export class IngestFhirXmlDto {
  @ApiProperty({
    description: 'FHIR resource or bundle in XML format (HL7 FHIR standard)',
    example: `<?xml version="1.0" encoding="UTF-8"?>
<Patient xmlns="http://hl7.org/fhir">
  <id value="example-patient-id"/>
  <name>
    <family value="Doe"/>
    <given value="John"/>
  </name>
  <birthDate value="1990-01-01"/>
  <gender value="male"/>
</Patient>`,
  })
  @IsString()
  @IsNotEmpty()
  xmlData: string;
}

export class IngestionResponseDto {
  @ApiProperty({ description: 'Whether ingestion was successful' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Internal patient ID' })
  patientId?: string;

  @ApiPropertyOptional({ description: 'Epic/FHIR patient ID' })
  epicId?: string;

  @ApiPropertyOptional({
    description: 'Count of ingested resources by type',
    example: {
      patient: 1,
      observations: 5,
      conditions: 2,
      allergies: 1,
      medications: 3,
      procedures: 1,
      encounters: 2,
      diagnosticReports: 1,
    },
  })
  ingested?: {
    patient?: number;
    observations?: number;
    conditions?: number;
    allergies?: number;
    medications?: number;
    procedures?: number;
    encounters?: number;
    diagnosticReports?: number;
  };

  @ApiPropertyOptional({
    description: 'Risk evaluation results after ingestion',
  })
  riskEvaluation?: {
    totalScore: number;
    matchedRulesCount: number;
    highestRiskLevel: string | null;
  };
}

