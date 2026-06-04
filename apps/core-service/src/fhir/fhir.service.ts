import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { TokenService } from '../token/token.service';

/**
 * Custom exception for forbidden scope errors
 * This allows us to catch and handle 403 errors gracefully
 */
export class ForbiddenScopeException extends Error {
  constructor(
    public readonly scope: string,
    message: string,
  ) {
    super(message);
    this.name = 'ForbiddenScopeException';
  }
}
import {
  FhirPatient,
  FhirObservation,
  FhirCondition,
  FhirAllergyIntolerance,
  FhirMedicationStatement,
  FhirProcedure,
  FhirEncounter,
  FhirDiagnosticReport,
  FhirPractitioner,
  FhirBundle,
} from './interfaces/fhir.interface';

@Injectable()
export class FhirService {
  private readonly logger = new Logger(FhirService.name);
  private readonly httpClient: AxiosInstance;
  private epicConfig: {
    fhirBaseUrl: string;
  };

  constructor(
    private configService: ConfigService,
    private tokenService: TokenService,
  ) {
    const config = this.configService.get('epic');
    if (!config) {
      throw new Error('Epic configuration is missing');
    }
    this.epicConfig = { fhirBaseUrl: config.fhirBaseUrl };
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        Accept: 'application/fhir+json',
        'Content-Type': 'application/fhir+json',
      },
    });
  }

  /**
   * Fetch patient information
   * @param patientId - Required patient ID
   */
  async getPatient(patientId: string): Promise<FhirPatient> {
    if (!patientId) {
      throw new BadRequestException('Patient ID is required');
    }

    const accessToken = this.tokenService.getToken()?.accessToken ?? '';

    try {
      const response = await this.httpClient.get<FhirPatient>(
        `${this.epicConfig.fhirBaseUrl}/Patient/${patientId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.handleFhirError(error, 'Failed to fetch patient');
      throw error;
    }
  }

  /**
   * Fetch observations for a patient
   * @param patientId - Required patient ID
   * @param category - Optional category filter (Epic requires either category or code)
   * @param count - Maximum number of results
   */
  async getObservations(
    patientId: string,
    category?: string,
    count: number = 100,
  ): Promise<FhirObservation[]> {
    if (!patientId) {
      throw new BadRequestException('Patient ID is required');
    }

    const accessToken = this.tokenService.getToken()?.accessToken ?? '';

    try {
      const params = new URLSearchParams({
        patient: patientId,
        _count: count.toString(),
      });

      // Epic requires either category or code parameter for Observation search
      // If category is not provided, use a default category to satisfy Epic's requirement
      if (category) {
        params.append('category', category);
      } else {
        // Use 'laboratory' as default category if none specified
        // This satisfies Epic's requirement for Observation searches
        params.append('category', 'laboratory');
      }

      const response = await this.httpClient.get<FhirBundle>(
        `${this.epicConfig.fhirBaseUrl}/Observation?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const observations: FhirObservation[] = [];
      if (response.data.entry) {
        for (const entry of response.data.entry) {
          if (entry.resource && entry.resource.resourceType === 'Observation') {
            observations.push(entry.resource as FhirObservation);
          }
        }
      }

      return observations;
    } catch (error) {
      this.handleFhirError(error, 'Failed to fetch observations');
      throw error;
    }
  }

  /**
   * Fetch conditions (diagnoses) for a patient
   * @param patientId - Required patient ID
   * @param count - Maximum number of results
   */
  async getConditions(
    patientId: string,
    count: number = 100,
  ): Promise<FhirCondition[]> {
    if (!patientId) {
      throw new BadRequestException('Patient ID is required');
    }

    const accessToken = this.tokenService.getToken()?.accessToken ?? '';

    try {
      const params = new URLSearchParams({
        patient: patientId,
        _count: count.toString(),
        _sort: '-date-recorded',
      });

      const response = await this.httpClient.get<FhirBundle>(
        `${this.epicConfig.fhirBaseUrl}/Condition?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const conditions: FhirCondition[] = [];
      if (response.data.entry) {
        for (const entry of response.data.entry) {
          if (entry.resource && entry.resource.resourceType === 'Condition') {
            conditions.push(entry.resource as FhirCondition);
          }
        }
      }

      return conditions;
    } catch (error) {
      this.handleFhirError(error, 'Failed to fetch conditions');
      throw error;
    }
  }

  /**
   * Fetch allergies for a patient
   * @param patientId - Required patient ID
   * @param count - Maximum number of results
   */
  async getAllergies(
    patientId: string,
    count: number = 100,
  ): Promise<FhirAllergyIntolerance[]> {
    if (!patientId) {
      throw new BadRequestException('Patient ID is required');
    }

    const accessToken = this.tokenService.getToken()?.accessToken ?? '';

    try {
      const params = new URLSearchParams({
        patient: patientId,
        _count: count.toString(),
      });

      const response = await this.httpClient.get<FhirBundle>(
        `${this.epicConfig.fhirBaseUrl}/AllergyIntolerance?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const allergies: FhirAllergyIntolerance[] = [];
      if (response.data.entry) {
        for (const entry of response.data.entry) {
          if (
            entry.resource &&
            entry.resource.resourceType === 'AllergyIntolerance'
          ) {
            allergies.push(entry.resource as FhirAllergyIntolerance);
          }
        }
      }

      return allergies;
    } catch (error) {
      this.handleFhirError(error, 'Failed to fetch allergies');
      throw error;
    }
  }

  /**
   * Fetch medications for a patient
   * @param patientId - Required patient ID
   * @param count - Maximum number of results
   */
  async getMedications(
    patientId: string,
    count: number = 100,
  ): Promise<FhirMedicationStatement[]> {
    if (!patientId) {
      throw new BadRequestException('Patient ID is required');
    }

    const accessToken = this.tokenService.getToken()?.accessToken ?? '';

    try {
      const params = new URLSearchParams({
        patient: patientId,
        _count: count.toString(),
      });

      const response = await this.httpClient.get<FhirBundle>(
        `${this.epicConfig.fhirBaseUrl}/MedicationStatement?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const medications: FhirMedicationStatement[] = [];
      if (response.data.entry) {
        for (const entry of response.data.entry) {
          if (
            entry.resource &&
            entry.resource.resourceType === 'MedicationStatement'
          ) {
            medications.push(entry.resource as FhirMedicationStatement);
          }
        }
      }

      return medications;
    } catch (error) {
      this.handleFhirError(error, 'Failed to fetch medications');
      throw error;
    }
  }

  /**
   * Fetch procedures for a patient
   * @param patientId - Required patient ID
   * @param count - Maximum number of results
   */
  async getProcedures(
    patientId: string,
    count: number = 100,
  ): Promise<FhirProcedure[]> {
    if (!patientId) {
      throw new BadRequestException('Patient ID is required');
    }

    const accessToken = this.tokenService.getToken()?.accessToken ?? '';

    try {
      const params = new URLSearchParams({
        patient: patientId,
        _count: count.toString(),
      });

      const response = await this.httpClient.get<FhirBundle>(
        `${this.epicConfig.fhirBaseUrl}/Procedure?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const procedures: FhirProcedure[] = [];
      if (response.data.entry) {
        for (const entry of response.data.entry) {
          if (entry.resource && entry.resource.resourceType === 'Procedure') {
            procedures.push(entry.resource as FhirProcedure);
          }
        }
      }

      return procedures;
    } catch (error) {
      this.handleFhirError(error, 'Failed to fetch procedures');
      throw error;
    }
  }

  /**
   * Fetch encounters (visits) for a patient
   * @param patientId - Required patient ID
   * @param count - Maximum number of results
   */
  async getEncounters(
    patientId: string,
    count: number = 100,
  ): Promise<FhirEncounter[]> {
    if (!patientId) {
      throw new BadRequestException('Patient ID is required');
    }

    const accessToken = this.tokenService.getToken()?.accessToken ?? '';

    try {
      const params = new URLSearchParams({
        patient: patientId,
        _count: count.toString(),
      });

      const response = await this.httpClient.get<FhirBundle>(
        `${this.epicConfig.fhirBaseUrl}/Encounter?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const encounters: FhirEncounter[] = [];
      if (response.data.entry) {
        for (const entry of response.data.entry) {
          if (entry.resource && entry.resource.resourceType === 'Encounter') {
            encounters.push(entry.resource as FhirEncounter);
          }
        }
      }

      return encounters;
    } catch (error) {
      this.handleFhirError(error, 'Failed to fetch encounters');
      throw error;
    }
  }

  /**
   * Fetch diagnostic reports for a patient
   * @param patientId - Required patient ID
   * @param count - Maximum number of results
   */
  async getDiagnosticReports(
    patientId: string,
    count: number = 100,
  ): Promise<FhirDiagnosticReport[]> {
    if (!patientId) {
      throw new BadRequestException('Patient ID is required');
    }

    const accessToken = this.tokenService.getToken()?.accessToken ?? '';

    try {
      const params = new URLSearchParams({
        patient: patientId,
        _count: count.toString(),
      });

      const response = await this.httpClient.get<FhirBundle>(
        `${this.epicConfig.fhirBaseUrl}/DiagnosticReport?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const diagnosticReports: FhirDiagnosticReport[] = [];
      if (response.data.entry) {
        for (const entry of response.data.entry) {
          if (
            entry.resource &&
            entry.resource.resourceType === 'DiagnosticReport'
          ) {
            diagnosticReports.push(entry.resource as FhirDiagnosticReport);
          }
        }
      }

      return diagnosticReports;
    } catch (error) {
      this.handleFhirError(error, 'Failed to fetch diagnostic reports');
      throw error;
    }
  }

  /**
   * Fetch practitioner information
   * @param practitionerId - Required practitioner ID
   */
  async getPractitioner(practitionerId: string): Promise<FhirPractitioner> {
    if (!practitionerId) {
      throw new BadRequestException('Practitioner ID is required');
    }

    const accessToken = this.tokenService.getToken()?.accessToken ?? '';

    try {
      const response = await this.httpClient.get<FhirPractitioner>(
        `${this.epicConfig.fhirBaseUrl}/Practitioner/${practitionerId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.handleFhirError(error, 'Failed to fetch practitioner');
      throw error;
    }
  }

  /**
   * Handle FHIR API errors
   */
  private handleFhirError(error: any, defaultMessage: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data;
        this.logger.error(
          `FHIR API error [${status}]: ${JSON.stringify(data)}`,
        );

        if (status === 401) {
          throw new BadRequestException(
            'Authentication failed. Token may be invalid or expired.',
          );
        } else if (status === 403) {
          // Determine which resource failed based on the error message (case-insensitive)
          const messageLower = defaultMessage.toLowerCase();
          let resourceHint = '';
          let scopeHint = '';
          
          if (messageLower.includes('observation')) {
            resourceHint = 'Observation resource';
            scopeHint = 'system/Observation.read';
          } else if (messageLower.includes('condition')) {
            resourceHint = 'Condition resource';
            scopeHint = 'system/Condition.read';
          } else if (messageLower.includes('patient')) {
            resourceHint = 'Patient resource';
            scopeHint = 'system/Patient.read';
          } else if (messageLower.includes('allergy')) {
            resourceHint = 'AllergyIntolerance resource';
            scopeHint = 'system/AllergyIntolerance.read';
          } else if (messageLower.includes('medication')) {
            resourceHint = 'MedicationStatement resource';
            scopeHint = 'system/MedicationStatement.read';
          } else if (messageLower.includes('procedure')) {
            resourceHint = 'Procedure resource';
            scopeHint = 'system/Procedure.read';
          } else if (messageLower.includes('encounter')) {
            resourceHint = 'Encounter resource';
            scopeHint = 'system/Encounter.read';
          } else if (messageLower.includes('diagnosticreport') || messageLower.includes('diagnostic report')) {
            resourceHint = 'DiagnosticReport resource';
            scopeHint = 'system/DiagnosticReport.read';
          } else if (messageLower.includes('practitioner')) {
            resourceHint = 'Practitioner resource';
            scopeHint = 'system/Practitioner.read';
          } else {
            resourceHint = 'a FHIR resource';
            scopeHint = 'the required scope';
          }
          
          // Throw ForbiddenScopeException instead of BadRequestException
          // This allows the clinical service to catch it and handle gracefully
          throw new ForbiddenScopeException(
            scopeHint,
            `Access forbidden. Insufficient permissions to access ${resourceHint}. Please verify that ${scopeHint} scope is enabled in your Epic App Orchard application.`,
          );
        } else if (status === 404) {
          throw new BadRequestException('Resource not found.');
        }
      }
    }
    this.logger.error(`${defaultMessage}: ${error.message}`, error.stack);
  }
}
