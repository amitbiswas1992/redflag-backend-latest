import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as xml2js from 'xml2js';

@Injectable()
export class XmlParserService {
  private readonly logger = new Logger(XmlParserService.name);
  private readonly parser: xml2js.Parser;

  constructor() {
    this.parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      explicitRoot: true,
      ignoreAttrs: false,
      trim: true,
      normalizeTags: false,
      normalize: true,
      explicitCharkey: false,
      charkey: '_',
      attrkey: '$',
    });
  }

  /**
   * Parse FHIR XML to JSON
   * @param xmlString - FHIR XML string
   * @returns Parsed FHIR resource or bundle as JSON
   */
  async parseFhirXml(xmlString: string): Promise<any> {
    if (!xmlString || typeof xmlString !== 'string') {
      throw new BadRequestException('Invalid XML string provided');
    }

    try {
      const result = await this.parser.parseStringPromise(xmlString);
      return this.convertXmlToFhirJson(result);
    } catch (error) {
      this.logger.error(
        `Error parsing FHIR XML: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to parse FHIR XML: ${error.message}`,
      );
    }
  }

  /**
   * Convert XML structure to FHIR JSON format
   */
  private convertXmlToFhirJson(xmlObj: any): any {
    // Handle Bundle
    if (xmlObj.Bundle) {
      return this.convertBundle(xmlObj.Bundle);
    }

    // Handle individual resources
    const resourceTypes = [
      'Patient',
      'Observation',
      'Condition',
      'AllergyIntolerance',
      'MedicationStatement',
      'Procedure',
      'Encounter',
      'DiagnosticReport',
      'Practitioner',
    ];

    for (const resourceType of resourceTypes) {
      if (xmlObj[resourceType]) {
        return this.convertResource(xmlObj[resourceType], resourceType);
      }
    }

    throw new BadRequestException(
      'Unknown FHIR resource type in XML. Supported types: Patient, Observation, Condition, AllergyIntolerance, MedicationStatement, Procedure, Encounter, DiagnosticReport, Practitioner, Bundle',
    );
  }

  /**
   * Convert Bundle XML to FHIR JSON Bundle
   */
  private convertBundle(bundleXml: any): any {
    const bundle: any = {
      resourceType: 'Bundle',
      type: bundleXml.type?._ || bundleXml.type || 'collection',
    };

    if (bundleXml.total) {
      bundle.total = parseInt(bundleXml.total._ || bundleXml.total, 10);
    }

    if (bundleXml.entry) {
      const entries = Array.isArray(bundleXml.entry)
        ? bundleXml.entry
        : [bundleXml.entry];
      bundle.entry = entries.map((entry: any) => {
        const resource = entry.resource || entry.Resource;
        if (!resource) {
          return null;
        }

        // Find the resource type
        const resourceType = Object.keys(resource)[0];
        const resourceData = resource[resourceType];

        return {
          resource: this.convertResource(resourceData, resourceType),
        };
      }).filter(Boolean);
    }

    return bundle;
  }

  /**
   * Convert individual resource XML to FHIR JSON
   */
  private convertResource(resourceXml: any, resourceType: string): any {
    const resource: any = {
      resourceType,
    };

    // Convert common fields
    if (resourceXml.id) {
      resource.id = resourceXml.id._ || resourceXml.id;
    }

    // Convert based on resource type
    switch (resourceType) {
      case 'Patient':
        return this.convertPatient(resourceXml, resource);
      case 'Observation':
        return this.convertObservation(resourceXml, resource);
      case 'Condition':
        return this.convertCondition(resourceXml, resource);
      case 'AllergyIntolerance':
        return this.convertAllergyIntolerance(resourceXml, resource);
      case 'MedicationStatement':
        return this.convertMedicationStatement(resourceXml, resource);
      case 'Procedure':
        return this.convertProcedure(resourceXml, resource);
      case 'Encounter':
        return this.convertEncounter(resourceXml, resource);
      case 'DiagnosticReport':
        return this.convertDiagnosticReport(resourceXml, resource);
      default:
        // Generic conversion for unknown types
        return this.convertGenericResource(resourceXml, resource);
    }
  }

  /**
   * Convert Patient XML to FHIR JSON
   */
  private convertPatient(patientXml: any, resource: any): any {
    if (patientXml.id) {
      resource.id = patientXml.id._ || patientXml.id;
    }

    if (patientXml.name) {
      const names = Array.isArray(patientXml.name)
        ? patientXml.name
        : [patientXml.name];
      resource.name = names.map((name: any) => ({
        family: name.family?._ || name.family,
        given: this.extractArray(name.given),
        text: name.text?._ || name.text,
      }));
    }

    if (patientXml.birthDate) {
      resource.birthDate = patientXml.birthDate._ || patientXml.birthDate;
    }

    if (patientXml.gender) {
      resource.gender = patientXml.gender._ || patientXml.gender;
    }

    if (patientXml.identifier) {
      resource.identifier = this.convertIdentifiers(patientXml.identifier);
    }

    return resource;
  }

  /**
   * Convert Observation XML to FHIR JSON
   */
  private convertObservation(obsXml: any, resource: any): any {
    if (obsXml.id) {
      resource.id = obsXml.id._ || obsXml.id;
    }

    if (obsXml.status) {
      resource.status = obsXml.status._ || obsXml.status;
    }

    if (obsXml.code) {
      resource.code = this.convertCodeableConcept(obsXml.code);
    }

    if (obsXml.category) {
      resource.category = this.convertArray(obsXml.category, (cat: any) => ({
        coding: this.convertCodings(cat.coding),
      }));
    }

    if (obsXml.effectiveDateTime) {
      resource.effectiveDateTime =
        obsXml.effectiveDateTime._ || obsXml.effectiveDateTime;
    }

    if (obsXml.valueQuantity) {
      resource.valueQuantity = this.convertQuantity(obsXml.valueQuantity);
    }

    if (obsXml.valueString) {
      resource.valueString = obsXml.valueString._ || obsXml.valueString;
    }

    if (obsXml.valueCodeableConcept) {
      resource.valueCodeableConcept = this.convertCodeableConcept(
        obsXml.valueCodeableConcept,
      );
    }

    if (obsXml.subject) {
      resource.subject = this.convertReference(obsXml.subject);
    }

    return resource;
  }

  /**
   * Convert Condition XML to FHIR JSON
   */
  private convertCondition(condXml: any, resource: any): any {
    if (condXml.id) {
      resource.id = condXml.id._ || condXml.id;
    }

    if (condXml.clinicalStatus) {
      resource.clinicalStatus = this.convertCodeableConcept(
        condXml.clinicalStatus,
      );
    }

    if (condXml.code) {
      resource.code = this.convertCodeableConcept(condXml.code);
    }

    if (condXml.category) {
      resource.category = this.convertArray(condXml.category, (cat: any) => ({
        coding: this.convertCodings(cat.coding),
      }));
    }

    if (condXml.onsetDateTime) {
      resource.onsetDateTime =
        condXml.onsetDateTime._ || condXml.onsetDateTime;
    }

    if (condXml.recordedDate) {
      resource.recordedDate = condXml.recordedDate._ || condXml.recordedDate;
    }

    if (condXml.subject) {
      resource.subject = this.convertReference(condXml.subject);
    }

    return resource;
  }

  /**
   * Convert AllergyIntolerance XML to FHIR JSON
   */
  private convertAllergyIntolerance(allergyXml: any, resource: any): any {
    if (allergyXml.id) {
      resource.id = allergyXml.id._ || allergyXml.id;
    }

    if (allergyXml.clinicalStatus) {
      resource.clinicalStatus = this.convertCodeableConcept(
        allergyXml.clinicalStatus,
      );
    }

    if (allergyXml.type) {
      resource.type = allergyXml.type._ || allergyXml.type;
    }

    if (allergyXml.category) {
      resource.category = this.extractArray(allergyXml.category);
    }

    if (allergyXml.criticality) {
      resource.criticality =
        allergyXml.criticality._ || allergyXml.criticality;
    }

    if (allergyXml.code) {
      resource.code = this.convertCodeableConcept(allergyXml.code);
    }

    if (allergyXml.recordedDate) {
      resource.recordedDate =
        allergyXml.recordedDate._ || allergyXml.recordedDate;
    }

    if (allergyXml.patient) {
      resource.patient = this.convertReference(allergyXml.patient);
    }

    return resource;
  }

  /**
   * Convert MedicationStatement XML to FHIR JSON
   */
  private convertMedicationStatement(medXml: any, resource: any): any {
    if (medXml.id) {
      resource.id = medXml.id._ || medXml.id;
    }

    if (medXml.status) {
      resource.status = medXml.status._ || medXml.status;
    }

    if (medXml.medicationCodeableConcept) {
      resource.medicationCodeableConcept = this.convertCodeableConcept(
        medXml.medicationCodeableConcept,
      );
    }

    if (medXml.medicationReference) {
      resource.medicationReference = this.convertReference(
        medXml.medicationReference,
      );
    }

    if (medXml.effectivePeriod) {
      resource.effectivePeriod = this.convertPeriod(medXml.effectivePeriod);
    }

    if (medXml.dateAsserted) {
      resource.dateAsserted = medXml.dateAsserted._ || medXml.dateAsserted;
    }

    if (medXml.dosage) {
      resource.dosage = this.convertArray(medXml.dosage, (dosage: any) => ({
        text: dosage.text?._ || dosage.text,
        route: dosage.route
          ? this.convertCodeableConcept(dosage.route)
          : undefined,
      }));
    }

    if (medXml.subject) {
      resource.subject = this.convertReference(medXml.subject);
    }

    return resource;
  }

  /**
   * Convert Procedure XML to FHIR JSON
   */
  private convertProcedure(procXml: any, resource: any): any {
    if (procXml.id) {
      resource.id = procXml.id._ || procXml.id;
    }

    if (procXml.status) {
      resource.status = procXml.status._ || procXml.status;
    }

    if (procXml.code) {
      resource.code = this.convertCodeableConcept(procXml.code);
    }

    if (procXml.category) {
      resource.category = this.convertCodeableConcept(procXml.category);
    }

    if (procXml.performedDateTime) {
      resource.performedDateTime =
        procXml.performedDateTime._ || procXml.performedDateTime;
    }

    if (procXml.performedPeriod) {
      resource.performedPeriod = this.convertPeriod(procXml.performedPeriod);
    }

    if (procXml.outcome) {
      resource.outcome = this.convertCodeableConcept(procXml.outcome);
    }

    if (procXml.subject) {
      resource.subject = this.convertReference(procXml.subject);
    }

    return resource;
  }

  /**
   * Convert Encounter XML to FHIR JSON
   */
  private convertEncounter(encXml: any, resource: any): any {
    if (encXml.id) {
      resource.id = encXml.id._ || encXml.id;
    }

    if (encXml.status) {
      resource.status = encXml.status._ || encXml.status;
    }

    if (encXml.class) {
      resource.class = {
        code: encXml.class.code?._ || encXml.class.code,
        display: encXml.class.display?._ || encXml.class.display,
        system: encXml.class.system?._ || encXml.class.system,
      };
    }

    if (encXml.type) {
      resource.type = this.convertArray(encXml.type, (type: any) => ({
        coding: this.convertCodings(type.coding),
      }));
    }

    if (encXml.period) {
      resource.period = this.convertPeriod(encXml.period);
    }

    if (encXml.reasonCode) {
      resource.reasonCode = this.convertArray(encXml.reasonCode, (reason: any) =>
        this.convertCodeableConcept(reason),
      );
    }

    if (encXml.subject) {
      resource.subject = this.convertReference(encXml.subject);
    }

    return resource;
  }

  /**
   * Convert DiagnosticReport XML to FHIR JSON
   */
  private convertDiagnosticReport(reportXml: any, resource: any): any {
    if (reportXml.id) {
      resource.id = reportXml.id._ || reportXml.id;
    }

    if (reportXml.status) {
      resource.status = reportXml.status._ || reportXml.status;
    }

    if (reportXml.code) {
      resource.code = this.convertCodeableConcept(reportXml.code);
    }

    if (reportXml.category) {
      resource.category = this.convertArray(reportXml.category, (cat: any) => ({
        coding: this.convertCodings(cat.coding),
      }));
    }

    if (reportXml.effectiveDateTime) {
      resource.effectiveDateTime =
        reportXml.effectiveDateTime._ || reportXml.effectiveDateTime;
    }

    if (reportXml.effectivePeriod) {
      resource.effectivePeriod = this.convertPeriod(reportXml.effectivePeriod);
    }

    if (reportXml.issued) {
      resource.issued = reportXml.issued._ || reportXml.issued;
    }

    if (reportXml.conclusion) {
      resource.conclusion = reportXml.conclusion._ || reportXml.conclusion;
    }

    if (reportXml.subject) {
      resource.subject = this.convertReference(reportXml.subject);
    }

    return resource;
  }

  /**
   * Generic resource converter for unknown types
   */
  private convertGenericResource(resourceXml: any, resource: any): any {
    // Basic conversion - just copy top-level properties
    Object.keys(resourceXml).forEach((key) => {
      if (key !== '$' && key !== '_') {
        const value = resourceXml[key];
        if (typeof value === 'object' && value !== null) {
          if (value._ !== undefined) {
            resource[key] = value._;
          } else {
            resource[key] = value;
          }
        } else {
          resource[key] = value;
        }
      }
    });
    return resource;
  }

  // Helper methods
  private convertCodeableConcept(concept: any): any {
    if (!concept) return undefined;

    const result: any = {};

    if (concept.text) {
      result.text = concept.text._ || concept.text;
    }

    if (concept.coding) {
      result.coding = this.convertCodings(concept.coding);
    }

    return result;
  }

  private convertCodings(coding: any): any[] {
    if (!coding) return [];

    const codings = Array.isArray(coding) ? coding : [coding];
    return codings.map((c: any) => ({
      system: c.system?._ || c.system,
      code: c.code?._ || c.code,
      display: c.display?._ || c.display,
    }));
  }

  private convertReference(ref: any): any {
    if (!ref) return undefined;

    return {
      reference: ref.reference?._ || ref.reference,
      display: ref.display?._ || ref.display,
    };
  }

  private convertPeriod(period: any): any {
    if (!period) return undefined;

    return {
      start: period.start?._ || period.start,
      end: period.end?._ || period.end,
    };
  }

  private convertQuantity(quantity: any): any {
    if (!quantity) return undefined;

    return {
      value: quantity.value?._ !== undefined
        ? parseFloat(quantity.value._)
        : quantity.value !== undefined
          ? parseFloat(quantity.value)
          : undefined,
      unit: quantity.unit?._ || quantity.unit,
      system: quantity.system?._ || quantity.system,
      code: quantity.code?._ || quantity.code,
    };
  }

  private convertIdentifiers(identifiers: any): any[] {
    if (!identifiers) return [];

    const ids = Array.isArray(identifiers) ? identifiers : [identifiers];
    return ids.map((id: any) => ({
      system: id.system?._ || id.system,
      value: id.value?._ || id.value,
    }));
  }

  private convertArray<T>(arr: any, converter?: (item: any) => T): T[] {
    if (!arr) return [];
    const items = Array.isArray(arr) ? arr : [arr];
    return converter ? items.map(converter) : items;
  }

  private extractArray(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((v) => v._ || v);
    }
    return [value._ || value];
  }
}

