import { ApiProperty } from '@nestjs/swagger';

export class PatientIdentifierDto {
  @ApiProperty({
    description: 'Identifier system',
    example: 'http://hospital.example.org/fhir/identifier/mrn',
  })
  system?: string;

  @ApiProperty({ description: 'Identifier value', example: 'MRN123456' })
  value?: string;
}

export class NormalizedPatientDto {
  @ApiProperty({
    description: 'Patient ID',
    example: 'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB',
  })
  id: string;

  @ApiProperty({
    description: 'Full name',
    example: 'John Doe',
    required: false,
  })
  name?: string;

  @ApiProperty({ description: 'First name', example: 'John', required: false })
  firstName?: string;

  @ApiProperty({ description: 'Last name', example: 'Doe', required: false })
  lastName?: string;

  @ApiProperty({
    description: 'Birth date',
    example: '1980-01-01',
    required: false,
  })
  birthDate?: string;

  @ApiProperty({ description: 'Gender', example: 'male', required: false })
  gender?: string;

  @ApiProperty({
    description: 'Patient identifiers',
    type: [PatientIdentifierDto],
    required: false,
  })
  identifiers?: PatientIdentifierDto[];
}

export class NormalizedObservationDto {
  @ApiProperty({ description: 'Observation ID', example: 'obs-123' })
  id: string;

  @ApiProperty({ description: 'Observation code', example: '8480-6' })
  code: string;

  @ApiProperty({
    description: 'Observation display name',
    example: 'Systolic blood pressure',
  })
  display: string;

  @ApiProperty({
    description: 'Observation category',
    example: 'vital-signs',
    required: false,
  })
  category?: string;

  @ApiProperty({
    description: 'Observation value (string or number)',
    example: 120,
    required: false,
  })
  value?: string | number;

  @ApiProperty({
    description: 'Observation unit',
    example: 'mmHg',
    required: false,
  })
  unit?: string;

  @ApiProperty({
    description: 'Observation date',
    example: '2024-01-05T10:30:00Z',
    required: false,
  })
  date?: string;

  @ApiProperty({ description: 'Observation status', example: 'final' })
  status: string;
}

export class NormalizedConditionDto {
  @ApiProperty({ description: 'Condition ID', example: 'cond-123' })
  id: string;

  @ApiProperty({ description: 'Condition code', example: 'E11.9' })
  code: string;

  @ApiProperty({
    description: 'Condition display name',
    example: 'Type 2 diabetes mellitus without complications',
  })
  display: string;

  @ApiProperty({
    description: 'Condition category',
    example: 'encounter-diagnosis',
    required: false,
  })
  category?: string;

  @ApiProperty({
    description: 'Condition status',
    example: 'active',
    required: false,
  })
  status?: string;

  @ApiProperty({
    description: 'Onset date',
    example: '2020-01-15',
    required: false,
  })
  onsetDate?: string;

  @ApiProperty({
    description: 'Recorded date',
    example: '2020-01-15T14:20:00Z',
    required: false,
  })
  recordedDate?: string;
}

export class ClinicalDataResponseDto {
  @ApiProperty({
    description: 'Patient information',
    type: NormalizedPatientDto,
  })
  patient: NormalizedPatientDto;

  @ApiProperty({
    description: 'Patient observations',
    type: [NormalizedObservationDto],
  })
  observations: NormalizedObservationDto[];

  @ApiProperty({
    description: 'Patient conditions',
    type: [NormalizedConditionDto],
  })
  conditions: NormalizedConditionDto[];
}
