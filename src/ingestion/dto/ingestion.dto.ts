import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

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
            identifier: [
              {
                system: 'http://hospital.example.org',
                value: 'MRN-12345',
              },
            ],
            name: [
              {
                family: 'Doe',
                given: ['John', 'Michael'],
                use: 'official',
              },
            ],
            telecom: [
              {
                system: 'phone',
                value: '555-123-4567',
                use: 'home',
              },
              {
                system: 'email',
                value: 'john.doe@example.com',
              },
            ],
            gender: 'male',
            birthDate: '1990-01-15',
            address: [
              {
                line: ['123 Main Street'],
                city: 'Springfield',
                state: 'IL',
                postalCode: '62701',
                country: 'USA',
              },
            ],
            maritalStatus: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
                  code: 'M',
                  display: 'Married',
                },
              ],
            },
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: 'obs-blood-pressure-1',
            status: 'final',
            category: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                    code: 'vital-signs',
                    display: 'Vital Signs',
                  },
                ],
              },
            ],
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '85354-9',
                  display: 'Blood pressure panel with all children optional',
                },
              ],
            },
            subject: {
              reference: 'Patient/example-patient-id',
            },
            effectiveDateTime: '2024-01-15T10:30:00Z',
            component: [
              {
                code: {
                  coding: [
                    {
                      system: 'http://loinc.org',
                      code: '8480-6',
                      display: 'Systolic blood pressure',
                    },
                  ],
                },
                valueQuantity: {
                  value: 120,
                  unit: 'mmHg',
                  system: 'http://unitsofmeasure.org',
                  code: 'mm[Hg]',
                },
              },
              {
                code: {
                  coding: [
                    {
                      system: 'http://loinc.org',
                      code: '8462-4',
                      display: 'Diastolic blood pressure',
                    },
                  ],
                },
                valueQuantity: {
                  value: 80,
                  unit: 'mmHg',
                  system: 'http://unitsofmeasure.org',
                  code: 'mm[Hg]',
                },
              },
            ],
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: 'obs-blood-glucose',
            status: 'final',
            category: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                    code: 'laboratory',
                    display: 'Laboratory',
                  },
                ],
              },
            ],
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '2339-0',
                  display: 'Glucose [Mass/volume] in Blood',
                },
              ],
            },
            subject: {
              reference: 'Patient/example-patient-id',
            },
            effectiveDateTime: '2024-01-15T08:00:00Z',
            valueQuantity: {
              value: 95,
              unit: 'mg/dL',
              system: 'http://unitsofmeasure.org',
              code: 'mg/dL',
            },
            interpretation: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                    code: 'N',
                    display: 'Normal',
                  },
                ],
              },
            ],
          },
        },
        {
          resource: {
            resourceType: 'Condition',
            id: 'condition-diabetes',
            clinicalStatus: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                  code: 'active',
                  display: 'Active',
                },
              ],
            },
            verificationStatus: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
                  code: 'confirmed',
                  display: 'Confirmed',
                },
              ],
            },
            category: [
              {
                coding: [
                  {
                    system: 'http://snomed.info/sct',
                    code: '64572001',
                    display: 'Disease',
                  },
                ],
              },
            ],
            code: {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: '44054006',
                  display: 'Diabetes mellitus type 2',
                },
                {
                  system: 'http://hl7.org/fhir/sid/icd-10-cm',
                  code: 'E11.9',
                  display: 'Type 2 diabetes mellitus without complications',
                },
              ],
            },
            subject: {
              reference: 'Patient/example-patient-id',
            },
            onsetDateTime: '2020-03-15',
            recordedDate: '2020-03-20',
          },
        },
        {
          resource: {
            resourceType: 'Condition',
            id: 'condition-hypertension',
            clinicalStatus: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                  code: 'active',
                  display: 'Active',
                },
              ],
            },
            verificationStatus: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
                  code: 'confirmed',
                  display: 'Confirmed',
                },
              ],
            },
            code: {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: '38341003',
                  display: 'Hypertensive disorder',
                },
                {
                  system: 'http://hl7.org/fhir/sid/icd-10-cm',
                  code: 'I10',
                  display: 'Essential (primary) hypertension',
                },
              ],
            },
            subject: {
              reference: 'Patient/example-patient-id',
            },
            onsetDateTime: '2019-06-10',
          },
        },
        {
          resource: {
            resourceType: 'AllergyIntolerance',
            id: 'allergy-penicillin',
            clinicalStatus: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
                  code: 'active',
                  display: 'Active',
                },
              ],
            },
            verificationStatus: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
                  code: 'confirmed',
                  display: 'Confirmed',
                },
              ],
            },
            type: 'allergy',
            category: ['medication'],
            criticality: 'high',
            code: {
              coding: [
                {
                  system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                  code: '7980',
                  display: 'Penicillin',
                },
              ],
            },
            patient: {
              reference: 'Patient/example-patient-id',
            },
            recordedDate: '2018-05-10',
            reaction: [
              {
                substance: {
                  coding: [
                    {
                      system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                      code: '7980',
                      display: 'Penicillin',
                    },
                  ],
                },
                manifestation: [
                  {
                    coding: [
                      {
                        system: 'http://snomed.info/sct',
                        code: '271807003',
                        display: 'Rash',
                      },
                    ],
                  },
                ],
                severity: 'severe',
              },
            ],
          },
        },
        {
          resource: {
            resourceType: 'MedicationStatement',
            id: 'medication-metformin',
            status: 'active',
            medicationCodeableConcept: {
              coding: [
                {
                  system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                  code: '6809',
                  display: 'Metformin hydrochloride 500 MG Oral Tablet',
                },
              ],
              text: 'Metformin 500mg',
            },
            subject: {
              reference: 'Patient/example-patient-id',
            },
            effectivePeriod: {
              start: '2020-03-20',
            },
            dosage: [
              {
                text: 'Take 1 tablet by mouth twice daily with meals',
                timing: {
                  repeat: {
                    frequency: 2,
                    period: 1,
                    periodUnit: 'd',
                  },
                },
                route: {
                  coding: [
                    {
                      system: 'http://snomed.info/sct',
                      code: '26643006',
                      display: 'Oral route',
                    },
                  ],
                },
                doseAndRate: [
                  {
                    doseQuantity: {
                      value: 1,
                      unit: 'tablet',
                    },
                  },
                ],
              },
            ],
          },
        },
        {
          resource: {
            resourceType: 'MedicationStatement',
            id: 'medication-lisinopril',
            status: 'active',
            medicationCodeableConcept: {
              coding: [
                {
                  system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                  code: '314076',
                  display: 'Lisinopril 10 MG Oral Tablet',
                },
              ],
              text: 'Lisinopril 10mg',
            },
            subject: {
              reference: 'Patient/example-patient-id',
            },
            effectivePeriod: {
              start: '2019-06-15',
            },
            dosage: [
              {
                text: 'Take 1 tablet by mouth once daily',
                timing: {
                  repeat: {
                    frequency: 1,
                    period: 1,
                    periodUnit: 'd',
                  },
                },
                route: {
                  coding: [
                    {
                      system: 'http://snomed.info/sct',
                      code: '26643006',
                      display: 'Oral route',
                    },
                  ],
                },
                doseAndRate: [
                  {
                    doseQuantity: {
                      value: 1,
                      unit: 'tablet',
                    },
                  },
                ],
              },
            ],
          },
        },
        {
          resource: {
            resourceType: 'Procedure',
            id: 'procedure-echocardiogram',
            status: 'completed',
            code: {
              coding: [
                {
                  system: 'http://www.ama-assn.org/go/cpt',
                  code: '93307',
                  display: 'Echocardiogram, transthoracic, real-time with image documentation',
                },
                {
                  system: 'http://snomed.info/sct',
                  code: '399208008',
                  display: 'Echocardiography',
                },
              ],
            },
            subject: {
              reference: 'Patient/example-patient-id',
            },
            performedDateTime: '2023-11-20T14:00:00Z',
            performer: [
              {
                actor: {
                  reference: 'Practitioner/cardiologist-001',
                  display: 'Dr. Jane Smith, Cardiologist',
                },
              },
            ],
            reasonCode: [
              {
                coding: [
                  {
                    system: 'http://snomed.info/sct',
                    code: '38341003',
                    display: 'Hypertensive disorder',
                  },
                ],
              },
            ],
          },
        },
        {
          resource: {
            resourceType: 'Encounter',
            id: 'encounter-routine-visit',
            status: 'finished',
            class: {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
              code: 'AMB',
              display: 'ambulatory',
            },
            type: [
              {
                coding: [
                  {
                    system: 'http://www.ama-assn.org/go/cpt',
                    code: '99213',
                    display: 'Office or other outpatient visit',
                  },
                ],
              },
            ],
            subject: {
              reference: 'Patient/example-patient-id',
            },
            period: {
              start: '2024-01-15T09:00:00Z',
              end: '2024-01-15T09:30:00Z',
            },
            reasonCode: [
              {
                coding: [
                  {
                    system: 'http://snomed.info/sct',
                    code: '185349003',
                    display: 'Consultation for treatment',
                  },
                ],
              },
            ],
            serviceProvider: {
              reference: 'Organization/hospital-001',
              display: 'Springfield General Hospital',
            },
          },
        },
        {
          resource: {
            resourceType: 'Encounter',
            id: 'encounter-emergency',
            status: 'finished',
            class: {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
              code: 'EMER',
              display: 'emergency',
            },
            type: [
              {
                coding: [
                  {
                    system: 'http://www.ama-assn.org/go/cpt',
                    code: '99284',
                    display: 'Emergency department visit',
                  },
                ],
              },
            ],
            subject: {
              reference: 'Patient/example-patient-id',
            },
            period: {
              start: '2023-08-10T22:15:00Z',
              end: '2023-08-11T01:30:00Z',
            },
            reasonCode: [
              {
                coding: [
                  {
                    system: 'http://snomed.info/sct',
                    code: '22298006',
                    display: 'Myocardial infarction',
                  },
                ],
              },
            ],
          },
        },
        {
          resource: {
            resourceType: 'DiagnosticReport',
            id: 'diagnostic-report-lab-panel',
            status: 'final',
            category: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
                    code: 'LAB',
                    display: 'Laboratory',
                  },
                ],
              },
            ],
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '24323-8',
                  display: 'Comprehensive metabolic panel',
                },
              ],
            },
            subject: {
              reference: 'Patient/example-patient-id',
            },
            effectiveDateTime: '2024-01-15T08:00:00Z',
            issued: '2024-01-15T10:00:00Z',
            performer: [
              {
                reference: 'Organization/lab-001',
                display: 'Springfield Lab Services',
              },
            ],
            result: [
              {
                reference: 'Observation/obs-blood-glucose',
                display: 'Blood Glucose',
              },
            ],
            conclusion: 'All values within normal limits',
          },
        },
        {
          resource: {
            resourceType: 'DiagnosticReport',
            id: 'diagnostic-report-echocardiogram',
            status: 'final',
            category: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
                    code: 'CUS',
                    display: 'Cardiac Ultrasound',
                  },
                ],
              },
            ],
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '34555-2',
                  display: 'Echocardiogram',
                },
              ],
            },
            subject: {
              reference: 'Patient/example-patient-id',
            },
            effectiveDateTime: '2023-11-20T14:00:00Z',
            issued: '2023-11-20T16:00:00Z',
            performer: [
              {
                reference: 'Practitioner/cardiologist-001',
                display: 'Dr. Jane Smith, Cardiologist',
              },
            ],
            conclusion: 'Normal left ventricular function. No significant valvular abnormalities.',
            conclusionCode: [
              {
                coding: [
                  {
                    system: 'http://snomed.info/sct',
                    code: '17621005',
                    display: 'Normal',
                  },
                ],
              },
            ],
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

// Simplified Bulk Ingestion DTOs
export class SimplePatientDto {
  @ApiProperty({ description: 'Epic/FHIR Patient ID', example: 'eq081-VQEgP8drUUqCWzHfw3' })
  @IsString()
  @IsNotEmpty()
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

  @ApiPropertyOptional({
    description: 'Birth date (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '1990-01-15',
  })
  @IsOptional()
  @IsString()
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

export class SimpleObservationDto {
  @ApiProperty({ description: 'Epic/FHIR Observation ID', example: 'obs-123' })
  @IsString()
  @IsNotEmpty()
  epicId: string;

  @ApiPropertyOptional({ description: 'Patient Epic ID (identifier for patient). If not provided, will use root-level epicId', example: 'patient-123' })
  @IsOptional()
  @IsString()
  patientEpicId?: string;

  @ApiPropertyOptional({ description: 'Test name', example: 'Blood Pressure' })
  @IsOptional()
  @IsString()
  testName?: string;

  @ApiPropertyOptional({ description: 'Test value', example: '120/80' })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({
    description:
      'Observation date (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Status', example: 'final' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Category', example: 'vital-signs' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Unit', example: 'mmHg' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: 'Code', example: '85354-9' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'Blood pressure panel' })
  @IsOptional()
  @IsString()
  display?: string;
}

export class SimpleConditionDto {
  @ApiProperty({ description: 'Epic/FHIR Condition ID', example: 'cond-123' })
  @IsString()
  @IsNotEmpty()
  epicId: string;

  @ApiPropertyOptional({ description: 'Patient Epic ID (identifier for patient). If not provided, will use root-level epicId', example: 'patient-123' })
  @IsOptional()
  @IsString()
  patientEpicId?: string;

  @ApiPropertyOptional({ description: 'Diagnosis', example: 'Type 2 diabetes mellitus' })
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional({ description: 'Status', example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description:
      'Onset date (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2020-03-15',
  })
  @IsOptional()
  @IsString()
  onsetDate?: string;

  @ApiPropertyOptional({
    description:
      'Recorded date (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2020-03-20',
  })
  @IsOptional()
  @IsString()
  recordedDate?: string;

  @ApiPropertyOptional({ description: 'Category', example: 'Disease' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Code', example: '44054006' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'Diabetes mellitus type 2' })
  @IsOptional()
  @IsString()
  display?: string;
}

export class SimpleAllergyDto {
  @ApiProperty({ description: 'Epic/FHIR AllergyIntolerance ID', example: 'allergy-123' })
  @IsString()
  @IsNotEmpty()
  epicId: string;

  @ApiPropertyOptional({ description: 'Patient Epic ID (identifier for patient). If not provided, will use root-level epicId', example: 'patient-123' })
  @IsOptional()
  @IsString()
  patientEpicId?: string;

  @ApiPropertyOptional({ description: 'Allergen name', example: 'Penicillin' })
  @IsOptional()
  @IsString()
  allergen?: string;

  @ApiPropertyOptional({ description: 'Type', example: 'allergy' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Status', example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Severity', example: 'severe' })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({ description: 'Criticality', example: 'high' })
  @IsOptional()
  @IsString()
  criticality?: string;

  @ApiPropertyOptional({
    description:
      'Recorded date (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2018-05-10',
  })
  @IsOptional()
  @IsString()
  recordedDate?: string;

  @ApiPropertyOptional({ description: 'Categories', type: 'array', example: ['medication'] })
  @IsOptional()
  @IsArray()
  category?: string[];

  @ApiPropertyOptional({ description: 'Code', example: '7980' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'Penicillin' })
  @IsOptional()
  @IsString()
  display?: string;
}

export class SimpleMedicationDto {
  @ApiProperty({ description: 'Epic/FHIR MedicationStatement ID', example: 'med-123' })
  @IsString()
  @IsNotEmpty()
  epicId: string;

  @ApiPropertyOptional({ description: 'Patient Epic ID (identifier for patient). If not provided, will use root-level epicId', example: 'patient-123' })
  @IsOptional()
  @IsString()
  patientEpicId?: string;

  @ApiPropertyOptional({ description: 'Medication name', example: 'Metformin 500mg' })
  @IsOptional()
  @IsString()
  medication?: string;

  @ApiPropertyOptional({ description: 'Status', example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Dosage', example: 'Take 1 tablet by mouth twice daily' })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional({ description: 'Route', example: 'oral' })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional({
    description:
      'Start date (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2020-03-20',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      'End date (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    description:
      'Date asserted (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2020-03-20',
  })
  @IsOptional()
  @IsString()
  dateAsserted?: string;

  @ApiPropertyOptional({ description: 'Code', example: '6809' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'Metformin hydrochloride 500 MG Oral Tablet' })
  @IsOptional()
  @IsString()
  display?: string;

  // Redflag-specific medication safety fields (all optional)
  @ApiPropertyOptional({ description: 'Whether this is a controlled substance', example: true })
  @IsOptional()
  controlledSubstancePrescribed?: boolean;

  @ApiPropertyOptional({ description: 'Number of refills', example: 3 })
  @IsOptional()
  refillCount?: number;

  @ApiPropertyOptional({ description: 'Whether auto-refill is enabled', example: false })
  @IsOptional()
  autoRefillEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Medication adherence status', example: 'Good' })
  @IsOptional()
  @IsString()
  medicationAdherence?: string;

  @ApiPropertyOptional({ description: 'Count of CDS alerts triggered', example: 1 })
  @IsOptional()
  clinicalDecisionSupport?: number;

  @ApiPropertyOptional({ description: 'Override reason when bypassing CDS alerts', example: 'Clinical judgment' })
  @IsOptional()
  @IsString()
  overrideReason?: string;

  @ApiPropertyOptional({ description: 'Dispensed quantity', example: 30 })
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ description: 'Substance code (e.g., RxNorm)', example: '12345' })
  @IsOptional()
  @IsString()
  substanceCode?: string;

  @ApiPropertyOptional({
    description:
      'Medication expiry date (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsString()
  substanceExpiry?: string;

  @ApiPropertyOptional({ description: 'Whether a prescription was written in this encounter', example: true })
  @IsOptional()
  prescriptionWritten?: boolean;
}

export class SimpleProcedureDto {
  @ApiProperty({ description: 'Epic/FHIR Procedure ID', example: 'proc-123' })
  @IsString()
  @IsNotEmpty()
  epicId: string;

  @ApiPropertyOptional({ description: 'Patient Epic ID (identifier for patient). If not provided, will use root-level epicId', example: 'patient-123' })
  @IsOptional()
  @IsString()
  patientEpicId?: string;

  @ApiPropertyOptional({ description: 'Procedure name', example: 'Echocardiogram' })
  @IsOptional()
  @IsString()
  procedure?: string;

  @ApiPropertyOptional({ description: 'Status', example: 'completed' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description:
      'Procedure date (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2023-11-20T14:00:00Z',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description:
      'Performed date (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2023-11-20T14:00:00Z',
  })
  @IsOptional()
  @IsString()
  performedDate?: string;

  @ApiPropertyOptional({ description: 'Outcome', example: 'Successful' })
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional({ description: 'Category', example: 'Cardiology' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Code', example: '93307' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'Echocardiogram, transthoracic' })
  @IsOptional()
  @IsString()
  display?: string;
}

export class SimpleEncounterDto {
  @ApiProperty({ description: 'Epic/FHIR Encounter ID', example: 'enc-123' })
  @IsString()
  @IsNotEmpty()
  epicId: string;

  @ApiPropertyOptional({ description: 'Patient Epic ID (identifier for patient). If not provided, will use root-level epicId', example: 'patient-123' })
  @IsOptional()
  @IsString()
  patientEpicId?: string;

  @ApiPropertyOptional({ description: 'Visit type', example: 'Office visit' })
  @IsOptional()
  @IsString()
  visitType?: string;

  @ApiPropertyOptional({ description: 'Status', example: 'finished' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description:
      'Start date (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2024-01-15T09:00:00Z',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      'End date (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2024-01-15T09:30:00Z',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Reason', example: 'Routine checkup' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Type', example: 'AMB' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Class', example: 'ambulatory' })
  @IsOptional()
  @IsString()
  class?: string;

  // FHIR Encounter + Redflag extensions (all optional)
  @ApiPropertyOptional({ description: 'Encounter priority', example: 'urgent' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ description: 'Service type / specialty', example: 'psychiatry' })
  @IsOptional()
  @IsString()
  serviceType?: string;

  @ApiPropertyOptional({ description: 'Subject status during encounter', example: 'inpatient' })
  @IsOptional()
  @IsString()
  subjectStatus?: string;

  @ApiPropertyOptional({ description: 'Encounter length in minutes', example: 30 })
  @IsOptional()
  lengthMinutes?: number;

  @ApiPropertyOptional({ description: 'Service provider organization reference id', example: 'org-123' })
  @IsOptional()
  @IsString()
  serviceProvider?: string;

  @ApiPropertyOptional({ description: 'Parent encounter id (if part of another encounter)', example: 'enc-parent-1' })
  @IsOptional()
  @IsString()
  partOfId?: string;

  // Telehealth / consent / licensure
  @ApiPropertyOptional({ description: 'Practitioner display name for the encounter', example: 'Dr. Jane Smith' })
  @IsOptional()
  @IsString()
  practitionerName?: string;

  @ApiPropertyOptional({ description: 'Whether this encounter was telehealth', example: true })
  @IsOptional()
  isTelehealth?: boolean;

  @ApiPropertyOptional({ description: 'Telehealth session identifier', example: 'tele-123' })
  @IsOptional()
  @IsString()
  telehealthId?: string;

  @ApiPropertyOptional({ description: 'Whether patient identity was verified', example: true })
  @IsOptional()
  patientIdentityVerified?: boolean;

  @ApiPropertyOptional({ description: 'Whether consent was obtained', example: true })
  @IsOptional()
  consentObtained?: boolean;

  @ApiPropertyOptional({ description: 'Type of informed consent', example: 'telehealth-specific' })
  @IsOptional()
  @IsString()
  informedConsentType?: string;

  @ApiPropertyOptional({ description: 'Whether session recording consent was obtained', example: false })
  @IsOptional()
  sessionRecordingConsent?: boolean;

  @ApiPropertyOptional({ description: 'Provider location (full)', example: 'Springfield, IL' })
  @IsOptional()
  @IsString()
  providerLocation?: string;

  @ApiPropertyOptional({ description: 'Provider location state', example: 'IL' })
  @IsOptional()
  @IsString()
  providerLocationState?: string;

  @ApiPropertyOptional({ description: 'Patient location (full)', example: 'Chicago, IL' })
  @IsOptional()
  @IsString()
  patientLocation?: string;

  @ApiPropertyOptional({ description: 'Patient location state', example: 'IL' })
  @IsOptional()
  @IsString()
  patientLocationState?: string;

  @ApiPropertyOptional({
    description: 'Per-state licensure verification map',
    example: { IL: true, CA: false },
  })
  @IsOptional()
  stateLicensureVerified?: Record<string, boolean | null>;

  @ApiPropertyOptional({ description: 'Whether cross-state license exists', example: false })
  @IsOptional()
  crossStateLicense?: boolean;

  // Assessment / documentation
  @ApiPropertyOptional({ description: 'Encounter type (e.g. New, Follow-up)', example: 'New' })
  @IsOptional()
  @IsString()
  encounterType?: string;

  @ApiPropertyOptional({ description: 'Session duration in minutes', example: 25 })
  @IsOptional()
  sessionDurationMinutes?: number;

  @ApiPropertyOptional({
    description:
      'Session start time (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2024-01-15T09:00:00Z',
  })
  @IsOptional()
  @IsString()
  sessionStartTime?: string;

  @ApiPropertyOptional({
    description:
      'Session end time (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2024-01-15T09:25:00Z',
  })
  @IsOptional()
  @IsString()
  sessionEndTime?: string;

  @ApiPropertyOptional({ description: 'Mental health screening status / instrument', example: 'PHQ-9 completed' })
  @IsOptional()
  @IsString()
  mentalHealthScreening?: string;

  @ApiPropertyOptional({ description: 'Substance use screening status / instrument', example: 'AUDIT-C completed' })
  @IsOptional()
  @IsString()
  substanceUseScreening?: string;

  @ApiPropertyOptional({ description: 'Chief complaint text', example: 'Difficulty concentrating at work' })
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiPropertyOptional({ description: 'Whether follow-up is scheduled', example: true })
  @IsOptional()
  followUpScheduled?: boolean;

  @ApiPropertyOptional({ description: 'Whether care plan was updated', example: true })
  @IsOptional()
  carePlanUpdated?: boolean;

  @ApiPropertyOptional({ description: 'Whether vital signs were recorded', example: true })
  @IsOptional()
  vitalSignsRecorded?: boolean;

  @ApiPropertyOptional({ description: 'Outcome measurement summary or scale', example: 'Improved' })
  @IsOptional()
  @IsString()
  outcomeMeasured?: string;

  @ApiPropertyOptional({ description: 'Whether coordination with PCP occurred', example: false })
  @IsOptional()
  coordinationWithPcp?: boolean;

  @ApiPropertyOptional({ description: 'Clinical notes completion status', example: 'Complete' })
  @IsOptional()
  @IsString()
  clinicalNotesCompleted?: string;

  @ApiPropertyOptional({
    description:
      'Note signed date/time (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2024-01-15T11:00:00Z',
  })
  @IsOptional()
  @IsString()
  noteSignedDate?: string;

  @ApiPropertyOptional({ description: 'Whether allergies were reviewed', example: true })
  @IsOptional()
  allergiesReviewed?: boolean;

  @ApiPropertyOptional({ description: 'Technology assessment result', example: 'Patient able to use video visit tools' })
  @IsOptional()
  @IsString()
  technologyAssessment?: string;

  @ApiPropertyOptional({ description: 'Clinical decision maker (for CPOM rules)', example: 'Licensed psychiatrist' })
  @IsOptional()
  @IsString()
  clinicalDecisionMaker?: string;

  @ApiPropertyOptional({ description: 'Whether quality measure was met', example: true })
  @IsOptional()
  qualityMeasureMet?: boolean;
}

export class SimpleDiagnosticReportDto {
  @ApiProperty({ description: 'Epic/FHIR DiagnosticReport ID', example: 'report-123' })
  @IsString()
  @IsNotEmpty()
  epicId: string;

  @ApiPropertyOptional({ description: 'Patient Epic ID (identifier for patient). If not provided, will use root-level epicId', example: 'patient-123' })
  @IsOptional()
  @IsString()
  patientEpicId?: string;

  @ApiPropertyOptional({ description: 'Report name', example: 'Comprehensive metabolic panel' })
  @IsOptional()
  @IsString()
  reportName?: string;

  @ApiPropertyOptional({ description: 'Status', example: 'final' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description:
      'Report date (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2024-01-15T08:00:00Z',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description:
      'Effective date (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2024-01-15T08:00:00Z',
  })
  @IsOptional()
  @IsString()
  effectiveDate?: string;

  @ApiPropertyOptional({
    description:
      'Issued date (ISO 8601 or free-form string, will be parsed on ingestion)',
    example: '2024-01-15T10:00:00Z',
  })
  @IsOptional()
  @IsString()
  issuedDate?: string;

  @ApiPropertyOptional({ description: 'Conclusion', example: 'All values within normal limits' })
  @IsOptional()
  @IsString()
  conclusion?: string;

  @ApiPropertyOptional({ description: 'Category', example: 'LAB' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Code', example: '24323-8' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'Comprehensive metabolic panel' })
  @IsOptional()
  @IsString()
  display?: string;
}

export class BulkIngestDto {
  @ApiPropertyOptional({
    description: 'Array of patient information (can create/update multiple patients)',
    type: [SimplePatientDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimplePatientDto)
  patients?: SimplePatientDto[];

  @ApiPropertyOptional({
    description: 'Array of observations',
    type: [SimpleObservationDto],
    example: [
      {
        epicId: 'obs-123',
        testName: 'Blood Pressure',
        value: '120/80',
        date: '2024-01-15T10:30:00Z',
        status: 'final',
        category: 'vital-signs',
        unit: 'mmHg',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimpleObservationDto)
  observations?: SimpleObservationDto[];

  @ApiPropertyOptional({
    description: 'Array of conditions',
    type: [SimpleConditionDto],
    example: [
      {
        epicId: 'cond-123',
        diagnosis: 'Type 2 diabetes mellitus',
        status: 'active',
        onsetDate: '2020-03-15',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimpleConditionDto)
  conditions?: SimpleConditionDto[];

  @ApiPropertyOptional({
    description: 'Array of allergies',
    type: [SimpleAllergyDto],
    example: [
      {
        epicId: 'allergy-123',
        allergen: 'Penicillin',
        type: 'allergy',
        status: 'active',
        severity: 'severe',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimpleAllergyDto)
  allergies?: SimpleAllergyDto[];

  @ApiPropertyOptional({
    description: 'Array of medications',
    type: [SimpleMedicationDto],
    example: [
      {
        epicId: 'med-123',
        medication: 'Metformin 500mg',
        status: 'active',
        dosage: 'Take 1 tablet by mouth twice daily',
        startDate: '2020-03-20',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimpleMedicationDto)
  medications?: SimpleMedicationDto[];

  @ApiPropertyOptional({
    description: 'Array of procedures',
    type: [SimpleProcedureDto],
    example: [
      {
        epicId: 'proc-123',
        procedure: 'Echocardiogram',
        status: 'completed',
        performedDate: '2023-11-20T14:00:00Z',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimpleProcedureDto)
  procedures?: SimpleProcedureDto[];

  @ApiPropertyOptional({
    description: 'Array of encounters',
    type: [SimpleEncounterDto],
    example: [
      {
        epicId: 'enc-123',
        visitType: 'Office visit',
        status: 'finished',
        startDate: '2024-01-15T09:00:00Z',
        endDate: '2024-01-15T09:30:00Z',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimpleEncounterDto)
  encounters?: SimpleEncounterDto[];

  @ApiPropertyOptional({
    description: 'Array of diagnostic reports',
    type: [SimpleDiagnosticReportDto],
    example: [
      {
        epicId: 'report-123',
        reportName: 'Comprehensive metabolic panel',
        status: 'final',
        date: '2024-01-15T08:00:00Z',
        conclusion: 'All values within normal limits',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimpleDiagnosticReportDto)
  diagnosticReports?: SimpleDiagnosticReportDto[];
}

