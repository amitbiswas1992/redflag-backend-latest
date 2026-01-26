import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  IsEnum,
  IsUUID,
} from 'class-validator';

// Patient DTOs
export class CreatePatientDto {
  @ApiProperty({ description: 'Epic FHIR Patient ID', example: 'eq081-VQEgP8drUUqCWzHfw3' })
  @IsString()
  epicId: string;

  @ApiPropertyOptional({ description: 'Full name', example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'First name', example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Birth date', example: '1975-05-15' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ description: 'Gender', example: 'male' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'Age', example: '45 years' })
  @IsOptional()
  @IsString()
  age?: string;

  @ApiPropertyOptional({ description: 'Date of birth (formatted)', example: 'May 15, 1975' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Identifiers', type: 'array' })
  @IsOptional()
  @IsArray()
  identifiers?: Array<{ system?: string; value?: string }>;
}

export class UpdatePatientDto {
  @ApiPropertyOptional({ description: 'Full name', example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'First name', example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Birth date', example: '1975-05-15' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ description: 'Gender', example: 'male' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'Age', example: '45 years' })
  @IsOptional()
  @IsString()
  age?: string;

  @ApiPropertyOptional({ description: 'Date of birth (formatted)', example: 'May 15, 1975' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Identifiers', type: 'array' })
  @IsOptional()
  @IsArray()
  identifiers?: Array<{ system?: string; value?: string }>;
}

// Practitioner DTOs
export class CreatePractitionerDto {
  @ApiProperty({ description: 'Epic FHIR Practitioner ID' })
  @IsString()
  epicId: string;

  @ApiPropertyOptional({ description: 'Full name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Prefixes', type: [String] })
  @IsOptional()
  @IsArray()
  prefix?: string[];

  @ApiPropertyOptional({ description: 'Suffixes', type: [String] })
  @IsOptional()
  @IsArray()
  suffix?: string[];

  @ApiPropertyOptional({ description: 'Gender' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'Birth date' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ description: 'Identifiers', type: 'array' })
  @IsOptional()
  @IsArray()
  identifiers?: Array<{ system?: string; value?: string; type?: string }>;

  @ApiPropertyOptional({ description: 'Telecom', type: 'array' })
  @IsOptional()
  @IsArray()
  telecom?: Array<{ system?: string; value?: string; use?: string }>;

  @ApiPropertyOptional({ description: 'Address', type: 'array' })
  @IsOptional()
  @IsArray()
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;

  @ApiPropertyOptional({ description: 'Qualifications', type: 'array' })
  @IsOptional()
  @IsArray()
  qualifications?: Array<{
    code?: string;
    display?: string;
    issuer?: string;
    period?: { start?: string; end?: string };
  }>;

  @ApiPropertyOptional({ description: 'Languages', type: [String] })
  @IsOptional()
  @IsArray()
  languages?: string[];
}

// Observation DTOs
export class CreateObservationDto {
  @ApiProperty({ description: 'Epic FHIR Observation ID' })
  @IsString()
  epicId: string;

  @ApiProperty({ description: 'Patient ID (UUID)' })
  @IsUUID()
  patientId: string;

  @ApiProperty({ description: 'Test name', example: 'Hemoglobin' })
  @IsString()
  testName: string;

  @ApiProperty({ description: 'Value', example: '14.2 g/dL' })
  @IsString()
  value: string;

  @ApiProperty({ description: 'Date', example: '2024-01-15T10:00:00Z' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Status', example: 'final' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Display' })
  @IsOptional()
  @IsString()
  display?: string;

  @ApiPropertyOptional({ description: 'Category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Unit' })
  @IsOptional()
  @IsString()
  unit?: string;
}

// Condition DTOs
export class CreateConditionDto {
  @ApiProperty({ description: 'Epic FHIR Condition ID' })
  @IsString()
  epicId: string;

  @ApiProperty({ description: 'Patient ID (UUID)' })
  @IsUUID()
  patientId: string;

  @ApiProperty({ description: 'Diagnosis', example: 'Type 2 diabetes mellitus' })
  @IsString()
  diagnosis: string;

  @ApiProperty({ description: 'Status', example: 'active' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Onset date' })
  @IsOptional()
  @IsDateString()
  onsetDate?: string;

  @ApiPropertyOptional({ description: 'Recorded date' })
  @IsOptional()
  @IsDateString()
  recordedDate?: string;

  @ApiPropertyOptional({ description: 'Code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Display' })
  @IsOptional()
  @IsString()
  display?: string;

  @ApiPropertyOptional({ description: 'Category' })
  @IsOptional()
  @IsString()
  category?: string;
}

// Allergy DTOs
export class CreateAllergyDto {
  @ApiProperty({ description: 'Epic FHIR AllergyIntolerance ID' })
  @IsString()
  epicId: string;

  @ApiProperty({ description: 'Patient ID (UUID)' })
  @IsUUID()
  patientId: string;

  @ApiProperty({ description: 'Allergen', example: 'Peanuts' })
  @IsString()
  allergen: string;

  @ApiProperty({ description: 'Type', example: 'allergy' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: 'Severity', example: 'high' })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiProperty({ description: 'Status', example: 'active' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Recorded date' })
  @IsOptional()
  @IsDateString()
  recordedDate?: string;

  @ApiPropertyOptional({ description: 'Code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Display' })
  @IsOptional()
  @IsString()
  display?: string;

  @ApiPropertyOptional({ description: 'Category', type: [String] })
  @IsOptional()
  @IsArray()
  category?: string[];

  @ApiPropertyOptional({ description: 'Criticality' })
  @IsOptional()
  @IsString()
  criticality?: string;
}

// Medication DTOs
export class CreateMedicationDto {
  @ApiProperty({ description: 'Epic FHIR MedicationStatement ID' })
  @IsString()
  epicId: string;

  @ApiProperty({ description: 'Patient ID (UUID)' })
  @IsUUID()
  patientId: string;

  @ApiProperty({ description: 'Medication', example: 'Lisinopril 10mg tablet' })
  @IsString()
  medication: string;

  @ApiProperty({ description: 'Status', example: 'active' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Dosage' })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional({ description: 'Route' })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Date asserted' })
  @IsOptional()
  @IsDateString()
  dateAsserted?: string;

  @ApiPropertyOptional({ description: 'Code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Display' })
  @IsOptional()
  @IsString()
  display?: string;
}

// Procedure DTOs
export class CreateProcedureDto {
  @ApiProperty({ description: 'Epic FHIR Procedure ID' })
  @IsString()
  epicId: string;

  @ApiProperty({ description: 'Patient ID (UUID)' })
  @IsUUID()
  patientId: string;

  @ApiProperty({ description: 'Procedure', example: 'Appendectomy' })
  @IsString()
  procedure: string;

  @ApiProperty({ description: 'Status', example: 'completed' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Date' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Outcome' })
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional({ description: 'Code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Display' })
  @IsOptional()
  @IsString()
  display?: string;

  @ApiPropertyOptional({ description: 'Category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Performed date' })
  @IsOptional()
  @IsDateString()
  performedDate?: string;
}

// Encounter DTOs
export class CreateEncounterDto {
  @ApiProperty({ description: 'Epic FHIR Encounter ID' })
  @IsString()
  epicId: string;

  @ApiProperty({ description: 'Patient ID (UUID)' })
  @IsUUID()
  patientId: string;

  @ApiProperty({ description: 'Visit type', example: 'Emergency' })
  @IsString()
  visitType: string;

  @ApiPropertyOptional({ description: 'Reason' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'Status', example: 'finished' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Class' })
  @IsOptional()
  @IsString()
  class?: string;
}

// DiagnosticReport DTOs
export class CreateDiagnosticReportDto {
  @ApiProperty({ description: 'Epic FHIR DiagnosticReport ID' })
  @IsString()
  epicId: string;

  @ApiProperty({ description: 'Patient ID (UUID)' })
  @IsUUID()
  patientId: string;

  @ApiProperty({ description: 'Report name', example: 'Chest X-Ray' })
  @IsString()
  reportName: string;

  @ApiProperty({ description: 'Status', example: 'final' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Date' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Conclusion' })
  @IsOptional()
  @IsString()
  conclusion?: string;

  @ApiPropertyOptional({ description: 'Code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Display' })
  @IsOptional()
  @IsString()
  display?: string;

  @ApiPropertyOptional({ description: 'Category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Effective date' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({ description: 'Issued date' })
  @IsOptional()
  @IsDateString()
  issuedDate?: string;
}

