export interface FhirPatient {
  id: string;
  name?: Array<{
    family?: string;
    given?: string[];
    text?: string;
  }>;
  birthDate?: string;
  gender?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
  }>;
}

export interface FhirObservation {
  id: string;
  status: string;
  category?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
  code: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  effectiveDateTime?: string;
  valueQuantity?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  valueString?: string;
  valueCodeableConcept?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject?: {
    reference?: string;
  };
}

export interface FhirCondition {
  id: string;
  clinicalStatus?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  category?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
  code: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  onsetDateTime?: string;
  recordedDate?: string;
  subject?: {
    reference?: string;
  };
}

export interface FhirBundle {
  resourceType: 'Bundle';
  type: string;
  total?: number;
  entry?: Array<{
    resource?: any;
  }>;
}
