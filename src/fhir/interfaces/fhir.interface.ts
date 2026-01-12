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

export interface FhirAllergyIntolerance {
  id: string;
  clinicalStatus?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  verificationStatus?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  type?: string;
  category?: Array<string>;
  criticality?: string;
  code: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  recordedDate?: string;
  recorder?: {
    reference?: string;
    display?: string;
  };
  patient?: {
    reference?: string;
  };
}

export interface FhirMedicationStatement {
  id: string;
  status: string;
  medicationCodeableConcept?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  medicationReference?: {
    reference?: string;
    display?: string;
  };
  effectivePeriod?: {
    start?: string;
    end?: string;
  };
  dateAsserted?: string;
  dosage?: Array<{
    text?: string;
    timing?: {
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: string;
      };
    };
    route?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    };
    doseQuantity?: {
      value?: number;
      unit?: string;
    };
  }>;
  subject?: {
    reference?: string;
  };
}

export interface FhirProcedure {
  id: string;
  status: string;
  code: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  performedDateTime?: string;
  performedPeriod?: {
    start?: string;
    end?: string;
  };
  category?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  outcome?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  subject?: {
    reference?: string;
  };
}

export interface FhirEncounter {
  id: string;
  status: string;
  class?: {
    system?: string;
    code?: string;
    display?: string;
  };
  type?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
  period?: {
    start?: string;
    end?: string;
  };
  reasonCode?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  subject?: {
    reference?: string;
  };
}

export interface FhirDiagnosticReport {
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
  effectivePeriod?: {
    start?: string;
    end?: string;
  };
  issued?: string;
  conclusion?: string;
  conclusionCode?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
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
