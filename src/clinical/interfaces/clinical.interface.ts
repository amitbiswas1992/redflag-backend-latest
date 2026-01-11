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

export interface ClinicalDataResponse {
  patient: NormalizedPatient;
  observations: NormalizedObservation[];
  conditions: NormalizedCondition[];
}
