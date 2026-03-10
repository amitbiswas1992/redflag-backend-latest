export interface NormalizedPatient {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  gender?: string;
  identifiers?: Array<{
    system?: string;
    value?: string;
  }>;
}

export interface NormalizedPractitioner {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  prefix?: string[];
  suffix?: string[];
  gender?: string;
  birthDate?: string;
  identifiers?: Array<{
    system?: string;
    value?: string;
    type?: string;
  }>;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  qualifications?: Array<{
    code?: string;
    display?: string;
    issuer?: string;
    period?: {
      start?: string;
      end?: string;
    };
  }>;
  languages?: string[];
}

export interface NormalizedObservation {
  id: string;
  code: string;
  display: string;
  category?: string;
  value?: string | number;
  unit?: string;
  date?: string;
  status: string;
}

export interface NormalizedCondition {
  id: string;
  code: string;
  display: string;
  category?: string;
  status?: string;
  onsetDate?: string;
  recordedDate?: string;
}

export interface NormalizedAllergy {
  id: string;
  code: string;
  display: string;
  type?: string;
  category?: string[];
  criticality?: string;
  status?: string;
  recordedDate?: string;
}

export interface NormalizedMedication {
  id: string;
  code: string;
  display: string;
  status: string;
  startDate?: string;
  endDate?: string;
  dateAsserted?: string;
  dosage?: string;
  route?: string;
  // Redflag-specific medication safety fields (all optional)
  controlledSubstancePrescribed?: boolean;
  refillCount?: number;
  autoRefillEnabled?: boolean;
  medicationAdherence?: string;
  clinicalDecisionSupport?: number;
  overrideReason?: string;
  quantity?: number;
  substanceCode?: string;
  substanceExpiry?: string;
  prescriptionWritten?: boolean;
}

export interface NormalizedProcedure {
  id: string;
  code: string;
  display: string;
  status: string;
  category?: string;
  performedDate?: string;
  outcome?: string;
}

export interface NormalizedEncounter {
  id: string;
  status: string;
  type?: string;
  class?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  // FHIR R5 Encounter extensions / Redflag-specific fields
  priority?: string;
  serviceType?: string;
  subjectStatus?: string;
  lengthMinutes?: number;
  serviceProvider?: string;
  partOfId?: string;
  // Telehealth & documentation fields used by risk rules
  practitionerName?: string;
  isTelehealth?: boolean;
  telehealthId?: string;
  patientIdentityVerified?: boolean;
  consentObtained?: boolean;
  sessionRecordingConsent?: boolean;
  providerLocation?: string;
  providerLocationState?: string;
  patientLocation?: string;
  patientLocationState?: string;
  stateLicensureVerified?: any;
  crossStateLicense?: boolean;
  encounterType?: string;
  sessionDurationMinutes?: number;
  sessionStartTime?: string;
  sessionEndTime?: string;
  mentalHealthScreening?: string;
  substanceUseScreening?: string;
  chiefComplaint?: string;
  followUpScheduled?: boolean;
  carePlanUpdated?: boolean;
  vitalSignsRecorded?: boolean;
  outcomeMeasured?: string;
  coordinationWithPcp?: boolean;
  clinicalNotesCompleted?: string;
  noteSignedDate?: string;
  allergiesReviewed?: boolean;
  technologyAssessment?: string;
  informedConsentType?: string;
  clinicalDecisionMaker?: string;
  qualityMeasureMet?: boolean;
}

export interface NormalizedDiagnosticReport {
  id: string;
  code: string;
  display: string;
  status: string;
  category?: string;
  effectiveDate?: string;
  issuedDate?: string;
  conclusion?: string;
}

export interface ClinicalDataResponse {
  patient: NormalizedPatient;
  observations: NormalizedObservation[];
  conditions: NormalizedCondition[];
}

export interface DiagnosisDataResponse {
  patient: NormalizedPatient;
  allergies: NormalizedAllergy[];
  medications: NormalizedMedication[];
  procedures: NormalizedProcedure[];
  encounters: NormalizedEncounter[];
  diagnosticReports: NormalizedDiagnosticReport[];
  observations: NormalizedObservation[];
  conditions: NormalizedCondition[];
  forbiddenScopes?: Record<string, 'forbidden'>;
}

export interface BulkPatientResponse {
  patients: NormalizedPatient[];
  total: number;
}

// Human-readable interfaces
export interface HumanReadablePatient {
  name: string;
  age?: string;
  gender?: string;
  dateOfBirth?: string;
  identifiers?: string[];
}

export interface HumanReadableObservation {
  testName: string;
  value: string;
  date: string;
  status: string;
}

export interface HumanReadableCondition {
  diagnosis: string;
  status: string;
  onsetDate?: string;
  recordedDate?: string;
}

export interface HumanReadableAllergy {
  allergen: string;
  type: string;
  severity?: string;
  status: string;
  recordedDate?: string;
}

export interface HumanReadableMedication {
  medication: string;
  status: string;
  dosage?: string;
  route?: string;
  startDate?: string;
  endDate?: string;
}

export interface HumanReadableProcedure {
  procedure: string;
  status: string;
  date?: string;
  outcome?: string;
}

export interface HumanReadableEncounter {
  visitType: string;
  reason?: string;
  startDate?: string;
  endDate?: string;
  status: string;
}

export interface HumanReadableDiagnosticReport {
  reportName: string;
  status: string;
  date?: string;
  conclusion?: string;
}

export interface HumanReadableClinicalData {
  patient: HumanReadablePatient;
  summary: {
    totalObservations: number;
    totalConditions: number;
    totalAllergies: number;
    totalMedications: number;
    totalProcedures: number;
    totalEncounters: number;
    totalReports: number;
  };
  observations: HumanReadableObservation[];
  conditions: HumanReadableCondition[];
  allergies: HumanReadableAllergy[];
  medications: HumanReadableMedication[];
  procedures: HumanReadableProcedure[];
  encounters: HumanReadableEncounter[];
  diagnosticReports: HumanReadableDiagnosticReport[];
  narrative: string;
  forbiddenScopes?: Record<string, 'forbidden'>;
}
