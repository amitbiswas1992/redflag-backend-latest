import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { ClinicalService } from './clinical.service';
import {
  NormalizedPatient,
  NormalizedObservation,
  NormalizedCondition,
  ClinicalDataResponse,
} from './interfaces/clinical.interface';
import {
  NormalizedPatientDto,
  NormalizedObservationDto,
  NormalizedConditionDto,
  ClinicalDataResponseDto,
} from './dto/clinical.dto';

@ApiTags('clinical')
@Controller('api/clinical')
export class ClinicalController {
  private readonly logger = new Logger(ClinicalController.name);

  constructor(private clinicalService: ClinicalService) {}

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
    } catch (error) {
      this.logger.error(
        `Error fetching patient: ${error.message}`,
        error.stack,
      );
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
    } catch (error) {
      this.logger.error(
        `Error fetching observations: ${error.message}`,
        error.stack,
      );
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
    } catch (error) {
      this.logger.error(
        `Error fetching conditions: ${error.message}`,
        error.stack,
      );
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
    } catch (error) {
      this.logger.error(
        `Error fetching clinical data: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
