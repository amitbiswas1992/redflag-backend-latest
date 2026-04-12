import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBody,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { ClinicalService } from './clinical.service';
import {
  NormalizedPatient,
  NormalizedPractitioner,
  NormalizedObservation,
  NormalizedCondition,
  NormalizedAllergy,
  NormalizedMedication,
  NormalizedProcedure,
  NormalizedEncounter,
  NormalizedDiagnosticReport,
  ClinicalDataResponse,
  DiagnosisDataResponse,
  BulkPatientResponse,
  HumanReadableClinicalData,
} from './interfaces/clinical.interface';
import {
  NormalizedPatientDto,
  NormalizedPractitionerDto,
  NormalizedObservationDto,
  NormalizedConditionDto,
  NormalizedAllergyDto,
  NormalizedMedicationDto,
  NormalizedProcedureDto,
  NormalizedEncounterDto,
  NormalizedDiagnosticReportDto,
  ClinicalDataResponseDto,
  DiagnosisDataResponseDto,
  BulkPatientResponseDto,
  HumanReadableClinicalDataDto,
} from './dto/clinical.dto';

@ApiTags('clinical')
@Controller('api/clinical')
export class ClinicalController {
  private readonly logger = new Logger(ClinicalController.name);

  constructor(private readonly clinicalService: ClinicalService) {}

  /**
   * GET /api/clinical/patient
   * Get normalized patient information
   * Query params: patientId (required)
   */
  @ApiOperation({
    summary: 'Get patient information',
    description:
      'Retrieves normalized patient information from Epic FHIR API. Requires a patient ID.',
  })
  @ApiQuery({
    name: 'patientId',
    required: true,
    description: 'Patient ID from Epic',
    example: 'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB',
  })
  @ApiOkResponse({
    description: 'Patient information retrieved successfully',
    type: NormalizedPatientDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid patient ID or patient not found',
  })
  @Get('patient')
  async getPatient(
    @Query('patientId') patientId: string,
  ): Promise<NormalizedPatient> {
    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }

    try {
      return await this.clinicalService.getPatient(patientId);
    } catch (error: unknown) {
      this.logFetchError('patient', error);
      throw error;
    }
  }

  /**
   * GET /api/clinical/practitioner
   * Get normalized practitioner information
   * Query params: practitionerId (required)
   */
  @ApiOperation({
    summary: 'Get practitioner information',
    description:
      'Retrieves normalized practitioner information from Epic FHIR API. Requires a practitioner ID.',
  })
  @ApiQuery({
    name: 'practitionerId',
    required: true,
    description: 'Practitioner ID from Epic',
    example: 'practitioner-0001',
  })
  @ApiOkResponse({
    description: 'Practitioner information retrieved successfully',
    type: NormalizedPractitionerDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid practitioner ID or practitioner not found',
  })
  @Get('practitioner')
  async getPractitioner(
    @Query('practitionerId') practitionerId: string,
  ): Promise<NormalizedPractitioner> {
    if (!practitionerId) {
      throw new BadRequestException('practitionerId is required');
    }

    try {
      return await this.clinicalService.getPractitioner(practitionerId);
    } catch (error: unknown) {
      this.logFetchError('practitioner', error);
      throw error;
    }
  }

  /**
   * GET /api/clinical/observations
   * Get normalized observations for a patient
   * Query params: patientId (required), category (optional)
   */
  @ApiOperation({
    summary: 'Get patient observations',
    description:
      'Retrieves normalized observations (lab results, vital signs, etc.) for a patient. Can filter by category.',
  })
  @ApiQuery({
    name: 'patientId',
    required: true,
    description: 'Patient ID from Epic',
    example: 'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description:
      'Filter observations by category (e.g., vital-signs, laboratory)',
    example: 'vital-signs',
  })
  @ApiOkResponse({
    description: 'Observations retrieved successfully',
    type: [NormalizedObservationDto],
  })
  @ApiBadRequestResponse({
    description: 'Invalid patient ID or patient not found',
  })
  @Get('observations')
  async getObservations(
    @Query('patientId') patientId: string,
    @Query('category') category?: string,
  ): Promise<NormalizedObservation[]> {
    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }

    try {
      return await this.clinicalService.getObservations(patientId, category);
    } catch (error: unknown) {
      this.logFetchError('observations', error);
      throw error;
    }
  }

  /**
   * GET /api/clinical/conditions
   * Get normalized conditions (diagnoses) for a patient
   * Query params: patientId (required)
   */
  @ApiOperation({
    summary: 'Get patient conditions (diagnoses)',
    description:
      'Retrieves normalized conditions/diagnoses for a patient from Epic FHIR API.',
  })
  @ApiQuery({
    name: 'patientId',
    required: true,
    description: 'Patient ID from Epic',
    example: 'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB',
  })
  @ApiOkResponse({
    description: 'Conditions retrieved successfully',
    type: [NormalizedConditionDto],
  })
  @ApiBadRequestResponse({
    description: 'Invalid patient ID or patient not found',
  })
  @Get('conditions')
  async getConditions(
    @Query('patientId') patientId: string,
  ): Promise<NormalizedCondition[]> {
    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }

    try {
      return await this.clinicalService.getConditions(patientId);
    } catch (error: unknown) {
      this.logFetchError('conditions', error);
      throw error;
    }
  }

  /**
   * GET /api/clinical/data
   * Get complete clinical data (patient, observations, conditions)
   * Query params: patientId (required)
   */
  @ApiOperation({
    summary: 'Get complete clinical data',
    description:
      'Retrieves complete clinical data including patient information, observations, and conditions in a single request.',
  })
  @ApiQuery({
    name: 'patientId',
    required: true,
    description: 'Patient ID from Epic',
    example: 'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB',
  })
  @ApiOkResponse({
    description: 'Clinical data retrieved successfully',
    type: ClinicalDataResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid patient ID or patient not found',
  })
  @Get('data')
  async getClinicalData(
    @Query('patientId') patientId: string,
  ): Promise<ClinicalDataResponse> {
    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }

    try {
      return await this.clinicalService.getClinicalData(patientId);
    } catch (error: unknown) {
      this.logFetchError('clinical data', error);
      throw error;
    }
  }

  /**
   * GET /api/clinical/allergies
   * Get normalized allergies for a patient
   * Query params: patientId (required)
   */
  @ApiOperation({
    summary: 'Get patient allergies',
    description: 'Retrieves normalized allergies for a patient.',
  })
  @ApiQuery({
    name: 'patientId',
    required: true,
    description: 'Patient ID from Epic',
    example: 'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB',
  })
  @ApiOkResponse({
    description: 'Allergies retrieved successfully',
    type: [NormalizedAllergyDto],
  })
  @ApiBadRequestResponse({
    description: 'Invalid patient ID or patient not found',
  })
  @Get('allergies')
  async getAllergies(
    @Query('patientId') patientId: string,
  ): Promise<NormalizedAllergy[]> {
    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }

    try {
      return await this.clinicalService.getAllergies(patientId);
    } catch (error: unknown) {
      this.logFetchError('allergies', error);
      throw error;
    }
  }

  /**
   * GET /api/clinical/medications
   * Get normalized medications for a patient
   * Query params: patientId (required)
   */
  @ApiOperation({
    summary: 'Get patient medications',
    description: 'Retrieves normalized medications for a patient.',
  })
  @ApiQuery({
    name: 'patientId',
    required: true,
    description: 'Patient ID from Epic',
    example: 'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB',
  })
  @ApiOkResponse({
    description: 'Medications retrieved successfully',
    type: [NormalizedMedicationDto],
  })
  @ApiBadRequestResponse({
    description: 'Invalid patient ID or patient not found',
  })
  @Get('medications')
  async getMedications(
    @Query('patientId') patientId: string,
  ): Promise<NormalizedMedication[]> {
    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }

    try {
      return await this.clinicalService.getMedications(patientId);
    } catch (error: unknown) {
      this.logFetchError('medications', error);
      throw error;
    }
  }

  /**
   * GET /api/clinical/procedures
   * Get normalized procedures for a patient
   * Query params: patientId (required)
   */
  @ApiOperation({
    summary: 'Get patient procedures',
    description: 'Retrieves normalized procedures for a patient.',
  })
  @ApiQuery({
    name: 'patientId',
    required: true,
    description: 'Patient ID from Epic',
    example: 'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB',
  })
  @ApiOkResponse({
    description: 'Procedures retrieved successfully',
    type: [NormalizedProcedureDto],
  })
  @ApiBadRequestResponse({
    description: 'Invalid patient ID or patient not found',
  })
  @Get('procedures')
  async getProcedures(
    @Query('patientId') patientId: string,
  ): Promise<NormalizedProcedure[]> {
    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }

    try {
      return await this.clinicalService.getProcedures(patientId);
    } catch (error: unknown) {
      this.logFetchError('procedures', error);
      throw error;
    }
  }

  /**
   * GET /api/clinical/encounters
   * Get normalized encounters (visits) for a patient
   * Query params: patientId (required)
   */
  @ApiOperation({
    summary: 'Get patient encounters',
    description: 'Retrieves normalized encounters (visits) for a patient.',
  })
  @ApiQuery({
    name: 'patientId',
    required: true,
    description: 'Patient ID from Epic',
    example: 'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB',
  })
  @ApiOkResponse({
    description: 'Encounters retrieved successfully',
    type: [NormalizedEncounterDto],
  })
  @ApiBadRequestResponse({
    description: 'Invalid patient ID or patient not found',
  })
  @Get('encounters')
  async getEncounters(
    @Query('patientId') patientId: string,
  ): Promise<NormalizedEncounter[]> {
    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }

    try {
      return await this.clinicalService.getEncounters(patientId);
    } catch (error: unknown) {
      this.logFetchError('encounters', error);
      throw error;
    }
  }

  /**
   * GET /api/clinical/diagnostic-reports
   * Get normalized diagnostic reports for a patient
   * Query params: patientId (required)
   */
  @ApiOperation({
    summary: 'Get patient diagnostic reports',
    description: 'Retrieves normalized diagnostic reports for a patient.',
  })
  @ApiQuery({
    name: 'patientId',
    required: true,
    description: 'Patient ID from Epic',
    example: 'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB',
  })
  @ApiOkResponse({
    description: 'Diagnostic reports retrieved successfully',
    type: [NormalizedDiagnosticReportDto],
  })
  @ApiBadRequestResponse({
    description: 'Invalid patient ID or patient not found',
  })
  @Get('diagnostic-reports')
  async getDiagnosticReports(
    @Query('patientId') patientId: string,
  ): Promise<NormalizedDiagnosticReport[]> {
    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }

    try {
      return await this.clinicalService.getDiagnosticReports(patientId);
    } catch (error: unknown) {
      this.logFetchError('diagnostic reports', error);
      throw error;
    }
  }

  /**
   * GET /api/clinical/diagnosis
   * Get comprehensive diagnosis data for a patient
   * Query params: patientId (required)
   */
  @ApiOperation({
    summary: 'Get comprehensive diagnosis data',
    description:
      'Retrieves all diagnosis-related data for a patient including allergies, medications, procedures, encounters, diagnostic reports, observations, and conditions.',
  })
  @ApiQuery({
    name: 'patientId',
    required: true,
    description: 'Patient ID from Epic',
    example: 'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB',
  })
  @ApiOkResponse({
    description: 'Diagnosis data retrieved successfully',
    type: DiagnosisDataResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid patient ID or patient not found',
  })
  @Get('diagnosis')
  async getDiagnosisData(
    @Query('patientId') patientId: string,
  ): Promise<DiagnosisDataResponse> {
    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }

    try {
      return await this.clinicalService.getDiagnosisData(patientId);
    } catch (error: unknown) {
      this.logFetchError('diagnosis data', error);
      throw error;
    }
  }

  /**
   * POST /api/clinical/patients/bulk
   * Get bulk patient data
   * Body: { patientIds: string[] }
   */
  @ApiOperation({
    summary: 'Get bulk patient data',
    description:
      'Retrieves normalized patient information for multiple patients at once.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        patientIds: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB',
            'patient-0002',
          ],
        },
      },
      required: ['patientIds'],
    },
  })
  @ApiOkResponse({
    description: 'Patients retrieved successfully',
    type: BulkPatientResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request body',
  })
  @Post('patients/bulk')
  async getBulkPatients(
    @Body() body: { patientIds: string[] },
  ): Promise<BulkPatientResponse> {
    const patientIds = this.validateBulkPatientBody(body);
    if (patientIds.length === 0) {
      return { patients: [], total: 0 };
    }

    try {
      return await this.clinicalService.getBulkPatients(patientIds);
    } catch (error: unknown) {
      this.logFetchError('bulk patients', error);
      throw error;
    }
  }

  private validateBulkPatientBody(body: { patientIds: string[] }): string[] {
    if (!body.patientIds || !Array.isArray(body.patientIds)) {
      throw new BadRequestException(
        'patientIds array is required in request body',
      );
    }

    return body.patientIds;
  }

  /**
   * GET /api/clinical/human-readable
   * Get human-readable clinical data for a patient
   * Query params: patientId (required)
   */
  @ApiOperation({
    summary: 'Get human-readable clinical data',
    description:
      'Retrieves all clinical data for a patient transformed into human-readable format with formatted dates, readable statuses, and a narrative summary.',
  })
  @ApiQuery({
    name: 'patientId',
    required: true,
    description: 'Patient ID from Epic',
    example: 'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB',
  })
  @ApiOkResponse({
    description: 'Human-readable clinical data retrieved successfully',
    type: HumanReadableClinicalDataDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid patient ID or patient not found',
  })
  @Get('human-readable')
  async getHumanReadableData(
    @Query('patientId') patientId: string,
  ): Promise<HumanReadableClinicalData> {
    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }

    try {
      return await this.clinicalService.getHumanReadableData(patientId);
    } catch (error: unknown) {
      this.logFetchError('human-readable data', error);
      throw error;
    }
  }

  private logFetchError(resource: string, error: unknown): void {
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error(`Error fetching ${resource}: ${message}`, stack);
  }
}
