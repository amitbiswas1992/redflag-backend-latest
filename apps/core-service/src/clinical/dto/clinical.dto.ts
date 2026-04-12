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

export class PractitionerIdentifierDto {
  @ApiProperty({
    description: 'Identifier system',
    example: 'http://hl7.org/fhir/sid/us-npi',
  })
  system?: string;

  @ApiProperty({ description: 'Identifier value', example: '1234567890' })
  value?: string;

  @ApiProperty({
    description: 'Identifier type',
    example: 'NPI',
    required: false,
  })
  type?: string;
}

export class PractitionerTelecomDto {
  @ApiProperty({
    description: 'Telecom system',
    example: 'phone',
    required: false,
  })
  system?: string;

  @ApiProperty({
    description: 'Telecom value',
    example: '+1-555-123-4567',
    required: false,
  })
  value?: string;

  @ApiProperty({
    description: 'Telecom use',
    example: 'work',
    required: false,
  })
  use?: string;
}

export class PractitionerAddressDto {
  @ApiProperty({
    description: 'Address lines',
    example: ['123 Main St'],
    required: false,
  })
  line?: string[];

  @ApiProperty({
    description: 'City',
    example: 'Springfield',
    required: false,
  })
  city?: string;

  @ApiProperty({
    description: 'State',
    example: 'IL',
    required: false,
  })
  state?: string;

  @ApiProperty({
    description: 'Postal code',
    example: '62701',
    required: false,
  })
  postalCode?: string;

  @ApiProperty({
    description: 'Country',
    example: 'USA',
    required: false,
  })
  country?: string;
}

export class PractitionerQualificationDto {
  @ApiProperty({
    description: 'Qualification code',
    example: 'MD',
    required: false,
  })
  code?: string;

  @ApiProperty({
    description: 'Qualification display name',
    example: 'Doctor of Medicine',
    required: false,
  })
  display?: string;

  @ApiProperty({
    description: 'Issuing organization',
    example: 'State Medical Board',
    required: false,
  })
  issuer?: string;

  @ApiProperty({
    description: 'Qualification period',
    required: false,
  })
  period?: {
    start?: string;
    end?: string;
  };
}

export class NormalizedPractitionerDto {
  @ApiProperty({
    description: 'Practitioner ID',
    example: 'practitioner-0001',
  })
  id: string;

  @ApiProperty({
    description: 'Full name',
    example: 'Dr. Jane Smith',
    required: false,
  })
  name?: string;

  @ApiProperty({
    description: 'First name',
    example: 'Jane',
    required: false,
  })
  firstName?: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Smith',
    required: false,
  })
  lastName?: string;

  @ApiProperty({
    description: 'Name prefix',
    example: ['Dr.'],
    required: false,
  })
  prefix?: string[];

  @ApiProperty({
    description: 'Name suffix',
    example: ['MD'],
    required: false,
  })
  suffix?: string[];

  @ApiProperty({
    description: 'Gender',
    example: 'female',
    required: false,
  })
  gender?: string;

  @ApiProperty({
    description: 'Birth date',
    example: '1975-05-15',
    required: false,
  })
  birthDate?: string;

  @ApiProperty({
    description: 'Practitioner identifiers',
    type: [PractitionerIdentifierDto],
    required: false,
  })
  identifiers?: PractitionerIdentifierDto[];

  @ApiProperty({
    description: 'Contact information',
    type: [PractitionerTelecomDto],
    required: false,
  })
  telecom?: PractitionerTelecomDto[];

  @ApiProperty({
    description: 'Addresses',
    type: [PractitionerAddressDto],
    required: false,
  })
  address?: PractitionerAddressDto[];

  @ApiProperty({
    description: 'Professional qualifications',
    type: [PractitionerQualificationDto],
    required: false,
  })
  qualifications?: PractitionerQualificationDto[];

  @ApiProperty({
    description: 'Languages spoken',
    example: ['English', 'Spanish'],
    required: false,
  })
  languages?: string[];
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

  @ApiProperty({
    description: 'Forbidden scopes - scopes that are not enabled in Epic App Orchard',
    example: {
      'system/Observation.read': 'forbidden',
      'system/Condition.read': 'forbidden',
    },
    required: false,
  })
  forbiddenScopes?: Record<string, 'forbidden'>;
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

// Human-readable DTOs
export class HumanReadablePatientDto {
  @ApiProperty({
    description: 'Patient full name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'Patient age',
    example: '45 years old',
    required: false,
  })
  age?: string;

  @ApiProperty({
    description: 'Patient gender',
    example: 'Male',
    required: false,
  })
  gender?: string;

  @ApiProperty({
    description: 'Date of birth in readable format',
    example: 'January 15, 1979',
    required: false,
  })
  dateOfBirth?: string;

  @ApiProperty({
    description: 'Patient identifiers',
    example: ['MRN123456 (MRN)', 'SSN123456789 (SSN)'],
    required: false,
  })
  identifiers?: string[];
}

export class HumanReadableObservationDto {
  @ApiProperty({
    description: 'Test or observation name',
    example: 'Systolic blood pressure',
  })
  testName: string;

  @ApiProperty({
    description: 'Formatted value with unit',
    example: '120 mmHg',
  })
  value: string;

  @ApiProperty({
    description: 'Date in readable format',
    example: 'January 15, 2024',
  })
  date: string;

  @ApiProperty({
    description: 'Status in readable format',
    example: 'Final',
  })
  status: string;
}

export class HumanReadableConditionDto {
  @ApiProperty({
    description: 'Diagnosis name',
    example: 'Type 2 diabetes mellitus without complications',
  })
  diagnosis: string;

  @ApiProperty({
    description: 'Status in readable format',
    example: 'Active',
  })
  status: string;

  @ApiProperty({
    description: 'Onset date in readable format',
    example: 'January 15, 2020',
    required: false,
  })
  onsetDate?: string;

  @ApiProperty({
    description: 'Recorded date in readable format',
    example: 'January 15, 2020',
    required: false,
  })
  recordedDate?: string;
}

export class HumanReadableAllergyDto {
  @ApiProperty({
    description: 'Allergen name',
    example: 'Allergy to peanuts',
  })
  allergen: string;

  @ApiProperty({
    description: 'Allergy type',
    example: 'Allergy',
  })
  type: string;

  @ApiProperty({
    description: 'Severity level',
    example: 'High',
    required: false,
  })
  severity?: string;

  @ApiProperty({
    description: 'Status in readable format',
    example: 'Active',
  })
  status: string;

  @ApiProperty({
    description: 'Recorded date in readable format',
    example: 'January 15, 2020',
    required: false,
  })
  recordedDate?: string;
}

export class HumanReadableMedicationDto {
  @ApiProperty({
    description: 'Medication name',
    example: 'Lisinopril 10mg tablet',
  })
  medication: string;

  @ApiProperty({
    description: 'Status in readable format',
    example: 'Active',
  })
  status: string;

  @ApiProperty({
    description: 'Dosage instructions',
    example: 'Take 1 tablet by mouth once daily',
    required: false,
  })
  dosage?: string;

  @ApiProperty({
    description: 'Administration route',
    example: 'Oral',
    required: false,
  })
  route?: string;

  @ApiProperty({
    description: 'Start date in readable format',
    example: 'January 15, 2020',
    required: false,
  })
  startDate?: string;

  @ApiProperty({
    description: 'End date in readable format',
    example: 'January 15, 2021',
    required: false,
  })
  endDate?: string;
}

export class HumanReadableProcedureDto {
  @ApiProperty({
    description: 'Procedure name',
    example: 'Appendectomy',
  })
  procedure: string;

  @ApiProperty({
    description: 'Status in readable format',
    example: 'Completed',
  })
  status: string;

  @ApiProperty({
    description: 'Performed date in readable format',
    example: 'June 15, 2020',
    required: false,
  })
  date?: string;

  @ApiProperty({
    description: 'Procedure outcome',
    example: 'Successful',
    required: false,
  })
  outcome?: string;
}

export class HumanReadableEncounterDto {
  @ApiProperty({
    description: 'Visit type',
    example: 'Office Visit',
  })
  visitType: string;

  @ApiProperty({
    description: 'Reason for visit',
    example: 'Annual physical examination',
    required: false,
  })
  reason?: string;

  @ApiProperty({
    description: 'Start date in readable format',
    example: 'January 15, 2024',
    required: false,
  })
  startDate?: string;

  @ApiProperty({
    description: 'End date in readable format',
    example: 'January 15, 2024',
    required: false,
  })
  endDate?: string;

  @ApiProperty({
    description: 'Status in readable format',
    example: 'Finished',
  })
  status: string;
}

export class HumanReadableDiagnosticReportDto {
  @ApiProperty({
    description: 'Report name',
    example: 'Complete blood count',
  })
  reportName: string;

  @ApiProperty({
    description: 'Status in readable format',
    example: 'Final',
  })
  status: string;

  @ApiProperty({
    description: 'Report date in readable format',
    example: 'January 15, 2024',
    required: false,
  })
  date?: string;

  @ApiProperty({
    description: 'Report conclusion',
    example: 'All values within normal limits',
    required: false,
  })
  conclusion?: string;
}

export class ClinicalSummaryDto {
  @ApiProperty({
    description: 'Total number of observations',
    example: 25,
  })
  totalObservations: number;

  @ApiProperty({
    description: 'Total number of conditions',
    example: 3,
  })
  totalConditions: number;

  @ApiProperty({
    description: 'Total number of allergies',
    example: 2,
  })
  totalAllergies: number;

  @ApiProperty({
    description: 'Total number of medications',
    example: 5,
  })
  totalMedications: number;

  @ApiProperty({
    description: 'Total number of procedures',
    example: 2,
  })
  totalProcedures: number;

  @ApiProperty({
    description: 'Total number of encounters',
    example: 10,
  })
  totalEncounters: number;

  @ApiProperty({
    description: 'Total number of diagnostic reports',
    example: 8,
  })
  totalReports: number;
}

export class HumanReadableClinicalDataDto {
  @ApiProperty({
    description: 'Human-readable patient information',
    type: HumanReadablePatientDto,
  })
  patient: HumanReadablePatientDto;

  @ApiProperty({
    description: 'Summary of clinical data counts',
    type: ClinicalSummaryDto,
  })
  summary: ClinicalSummaryDto;

  @ApiProperty({
    description: 'Human-readable observations',
    type: [HumanReadableObservationDto],
  })
  observations: HumanReadableObservationDto[];

  @ApiProperty({
    description: 'Human-readable conditions',
    type: [HumanReadableConditionDto],
  })
  conditions: HumanReadableConditionDto[];

  @ApiProperty({
    description: 'Human-readable allergies',
    type: [HumanReadableAllergyDto],
  })
  allergies: HumanReadableAllergyDto[];

  @ApiProperty({
    description: 'Human-readable medications',
    type: [HumanReadableMedicationDto],
  })
  medications: HumanReadableMedicationDto[];

  @ApiProperty({
    description: 'Human-readable procedures',
    type: [HumanReadableProcedureDto],
  })
  procedures: HumanReadableProcedureDto[];

  @ApiProperty({
    description: 'Human-readable encounters',
    type: [HumanReadableEncounterDto],
  })
  encounters: HumanReadableEncounterDto[];

  @ApiProperty({
    description: 'Human-readable diagnostic reports',
    type: [HumanReadableDiagnosticReportDto],
  })
  diagnosticReports: HumanReadableDiagnosticReportDto[];

  @ApiProperty({
    description: 'Narrative summary of patient data',
    example:
      'Patient Summary for John Doe, 45 years old (Male). Active conditions: Type 2 diabetes mellitus without complications. Known allergies: Allergy to peanuts. Current medications: Lisinopril 10mg tablet. Total records: 25 observations, 3 conditions, 2 allergies, 5 medications.',
  })
  narrative: string;

  @ApiProperty({
    description: 'Forbidden scopes - scopes that are not enabled in Epic App Orchard',
    example: {
      'system/Observation.read': 'forbidden',
      'system/Condition.read': 'forbidden',
    },
    required: false,
  })
  forbiddenScopes?: Record<string, 'forbidden'>;
}
