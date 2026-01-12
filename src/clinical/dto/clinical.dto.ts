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

export class NormalizedAllergyDto {
  @ApiProperty({ description: 'Allergy ID', example: 'allergy-123' })
  id: string;

  @ApiProperty({ description: 'Allergy code', example: '419199007' })
  code: string;

  @ApiProperty({
    description: 'Allergy display name',
    example: 'Allergy to peanuts',
  })
  display: string;

  @ApiProperty({
    description: 'Allergy type',
    example: 'allergy',
    required: false,
  })
  type?: string;

  @ApiProperty({
    description: 'Allergy categories',
    example: ['food'],
    required: false,
  })
  category?: string[];

  @ApiProperty({
    description: 'Criticality level',
    example: 'high',
    required: false,
  })
  criticality?: string;

  @ApiProperty({
    description: 'Clinical status',
    example: 'active',
    required: false,
  })
  status?: string;

  @ApiProperty({
    description: 'Recorded date',
    example: '2020-01-15T14:20:00Z',
    required: false,
  })
  recordedDate?: string;
}

export class NormalizedMedicationDto {
  @ApiProperty({ description: 'Medication ID', example: 'med-123' })
  id: string;

  @ApiProperty({ description: 'Medication code', example: '197806' })
  code: string;

  @ApiProperty({
    description: 'Medication display name',
    example: 'Lisinopril 10mg tablet',
  })
  display: string;

  @ApiProperty({
    description: 'Medication status',
    example: 'active',
  })
  status: string;

  @ApiProperty({
    description: 'Start date',
    example: '2020-01-15',
    required: false,
  })
  startDate?: string;

  @ApiProperty({
    description: 'End date',
    example: '2021-01-15',
    required: false,
  })
  endDate?: string;

  @ApiProperty({
    description: 'Date asserted',
    example: '2020-01-15T14:20:00Z',
    required: false,
  })
  dateAsserted?: string;

  @ApiProperty({
    description: 'Dosage instructions',
    example: 'Take 1 tablet by mouth once daily',
    required: false,
  })
  dosage?: string;

  @ApiProperty({
    description: 'Administration route',
    example: 'oral',
    required: false,
  })
  route?: string;
}

export class NormalizedProcedureDto {
  @ApiProperty({ description: 'Procedure ID', example: 'proc-123' })
  id: string;

  @ApiProperty({ description: 'Procedure code', example: '27447-1' })
  code: string;

  @ApiProperty({
    description: 'Procedure display name',
    example: 'Appendectomy',
  })
  display: string;

  @ApiProperty({
    description: 'Procedure status',
    example: 'completed',
  })
  status: string;

  @ApiProperty({
    description: 'Procedure category',
    example: 'procedure',
    required: false,
  })
  category?: string;

  @ApiProperty({
    description: 'Performed date',
    example: '2020-06-15',
    required: false,
  })
  performedDate?: string;

  @ApiProperty({
    description: 'Procedure outcome',
    example: 'successful',
    required: false,
  })
  outcome?: string;
}

export class NormalizedEncounterDto {
  @ApiProperty({ description: 'Encounter ID', example: 'enc-123' })
  id: string;

  @ApiProperty({
    description: 'Encounter status',
    example: 'finished',
  })
  status: string;

  @ApiProperty({
    description: 'Encounter type',
    example: 'Office Visit',
    required: false,
  })
  type?: string;

  @ApiProperty({
    description: 'Encounter class',
    example: 'ambulatory',
    required: false,
  })
  class?: string;

  @ApiProperty({
    description: 'Start date',
    example: '2024-01-15T10:00:00Z',
    required: false,
  })
  startDate?: string;

  @ApiProperty({
    description: 'End date',
    example: '2024-01-15T10:30:00Z',
    required: false,
  })
  endDate?: string;

  @ApiProperty({
    description: 'Reason for encounter',
    example: 'Annual physical examination',
    required: false,
  })
  reason?: string;
}

export class NormalizedDiagnosticReportDto {
  @ApiProperty({ description: 'Diagnostic report ID', example: 'report-123' })
  id: string;

  @ApiProperty({ description: 'Report code', example: '58410-2' })
  code: string;

  @ApiProperty({
    description: 'Report display name',
    example: 'Complete blood count',
  })
  display: string;

  @ApiProperty({
    description: 'Report status',
    example: 'final',
  })
  status: string;

  @ApiProperty({
    description: 'Report category',
    example: 'LAB',
    required: false,
  })
  category?: string;

  @ApiProperty({
    description: 'Effective date',
    example: '2024-01-15T10:00:00Z',
    required: false,
  })
  effectiveDate?: string;

  @ApiProperty({
    description: 'Issued date',
    example: '2024-01-15T14:00:00Z',
    required: false,
  })
  issuedDate?: string;

  @ApiProperty({
    description: 'Report conclusion',
    example: 'All values within normal limits',
    required: false,
  })
  conclusion?: string;
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

export class DiagnosisDataResponseDto {
  @ApiProperty({
    description: 'Patient information',
    type: NormalizedPatientDto,
  })
  patient: NormalizedPatientDto;

  @ApiProperty({
    description: 'Patient allergies',
    type: [NormalizedAllergyDto],
  })
  allergies: NormalizedAllergyDto[];

  @ApiProperty({
    description: 'Patient medications',
    type: [NormalizedMedicationDto],
  })
  medications: NormalizedMedicationDto[];

  @ApiProperty({
    description: 'Patient procedures',
    type: [NormalizedProcedureDto],
  })
  procedures: NormalizedProcedureDto[];

  @ApiProperty({
    description: 'Patient encounters',
    type: [NormalizedEncounterDto],
  })
  encounters: NormalizedEncounterDto[];

  @ApiProperty({
    description: 'Diagnostic reports',
    type: [NormalizedDiagnosticReportDto],
  })
  diagnosticReports: NormalizedDiagnosticReportDto[];

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

export class BulkPatientResponseDto {
  @ApiProperty({
    description: 'Array of patients',
    type: [NormalizedPatientDto],
  })
  patients: NormalizedPatientDto[];

  @ApiProperty({
    description: 'Total number of patients returned',
    example: 5,
  })
  total: number;
}
