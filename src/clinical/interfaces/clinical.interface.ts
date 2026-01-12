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
}

export interface BulkPatientResponse {
  patients: NormalizedPatient[];
  total: number;
}
