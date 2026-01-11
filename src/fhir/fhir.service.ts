import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { AuthService } from '../auth/auth.service';
import {
  FhirPatient,
  FhirObservation,
  FhirCondition,
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
    private authService: AuthService,
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

    const accessToken = await this.authService.getAccessToken();

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

    const accessToken = await this.authService.getAccessToken();

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

    const accessToken = await this.authService.getAccessToken();

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
          // Determine which resource failed based on the error message
          let resourceHint = '';
          if (defaultMessage.includes('Observation')) {
            resourceHint =
              ' Observation resource. Please verify that system/Observation.read scope is enabled in your Epic App Orchard application.';
          } else if (defaultMessage.includes('Condition')) {
            resourceHint =
              ' Condition resource. Please verify that system/Condition.read scope is enabled in your Epic App Orchard application.';
          } else if (defaultMessage.includes('Patient')) {
            resourceHint =
              ' Patient resource. Please verify that system/Patient.read scope is enabled in your Epic App Orchard application.';
          }
          throw new BadRequestException(
            `Access forbidden. Insufficient permissions to access${resourceHint} Contact your Epic support team to enable the required scopes. See docs/SCOPE_TROUBLESHOOTING.md for details.`,
          );
        } else if (status === 404) {
          throw new BadRequestException('Resource not found.');
        }
      }
    }
    this.logger.error(`${defaultMessage}: ${error.message}`, error.stack);
  }
}
