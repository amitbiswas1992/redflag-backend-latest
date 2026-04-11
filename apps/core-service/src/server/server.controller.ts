import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ServerService } from './server.service';
import {
  CreatePatientDto,
  UpdatePatientDto,
  CreatePractitionerDto,
} from './dto/server.dto';

@Controller('server')
export class ServerController {
  private readonly logger = new Logger(ServerController.name);

  constructor(private readonly serverService: ServerService) {}

  // Patient endpoints
  @ApiOperation({ summary: 'Create a new patient' })
  @ApiBody({ type: CreatePatientDto })
  @ApiCreatedResponse({ description: 'Patient created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input or patient already exists' })
  @Post('patients')
  async createPatient(@Body() createPatientDto: CreatePatientDto) {
    return this.serverService.createPatient(createPatientDto);
  }

  @ApiOperation({ summary: 'Get all patients' })
  @ApiQuery({ name: 'skip', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'take', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'hasIssue',
    required: false,
    type: Boolean,
    example: true,
    description:
      'Filter patients by whether they have matched issues (risk evaluations). true = only patients with issues, false = only patients without issues, omitted = all patients',
  })
  @ApiOkResponse({ description: 'List of patients retrieved successfully' })
  @Get('patients')
  async findAllPatients(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('hasIssue') hasIssue?: string,
  ) {
    let hasIssueFilter: boolean | undefined;
    if (typeof hasIssue === 'string') {
      const normalized = hasIssue.toLowerCase();
      if (normalized === 'true') hasIssueFilter = true;
      else if (normalized === 'false') hasIssueFilter = false;
    }

    return this.serverService.findAllPatients(
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 10,
      hasIssueFilter,
    );
  }

  @ApiOperation({ summary: 'Get patient by ID' })
  @ApiParam({ name: 'id', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Patient retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @Get('patients/:id')
  async findPatientById(@Param('id') id: string) {
    return this.serverService.findPatientById(id);
  }

  @ApiOperation({ summary: 'Get patient by Epic ID' })
  @ApiParam({ name: 'epicId', description: 'Epic FHIR Patient ID' })
  @ApiOkResponse({ description: 'Patient retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @Get('patients/epic/:epicId')
  async findPatientByEpicId(@Param('epicId') epicId: string) {
    return this.serverService.findPatientByEpicId(epicId);
  }

  @ApiOperation({ summary: 'Update a patient' })
  @ApiParam({ name: 'id', description: 'Patient UUID' })
  @ApiBody({ type: UpdatePatientDto })
  @ApiOkResponse({ description: 'Patient updated successfully' })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @Put('patients/:id')
  async updatePatient(
    @Param('id') id: string,
    @Body() updatePatientDto: UpdatePatientDto,
  ) {
    return this.serverService.updatePatient(id, updatePatientDto);
  }

  @ApiOperation({ summary: 'Delete a patient' })
  @ApiParam({ name: 'id', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Patient deleted successfully' })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @HttpCode(HttpStatus.OK)
  @Delete('patients/:id')
  async deletePatient(@Param('id') id: string) {
    return this.serverService.deletePatient(id);
  }

  // Practitioner endpoints
  @ApiOperation({ summary: 'Create a new practitioner' })
  @ApiBody({ type: CreatePractitionerDto })
  @ApiCreatedResponse({ description: 'Practitioner created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input or practitioner already exists' })
  @Post('practitioners')
  async createPractitioner(@Body() createPractitionerDto: CreatePractitionerDto) {
    return this.serverService.createPractitioner(createPractitionerDto);
  }

  @ApiOperation({ summary: 'Get all practitioners' })
  @ApiQuery({ name: 'skip', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'take', required: false, type: Number, example: 10 })
  @ApiOkResponse({ description: 'List of practitioners retrieved successfully' })
  @Get('practitioners')
  async findAllPractitioners(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.serverService.findAllPractitioners(
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 10,
    );
  }

  @ApiOperation({ summary: 'Get practitioner by ID' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiOkResponse({ description: 'Practitioner retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Practitioner not found' })
  @Get('practitioners/:id')
  async findPractitionerById(@Param('id') id: string) {
    return this.serverService.findPractitionerById(id);
  }

  @ApiOperation({ summary: 'Get practitioner by Epic ID' })
  @ApiParam({ name: 'epicId', description: 'Epic FHIR Practitioner ID' })
  @ApiOkResponse({ description: 'Practitioner retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Practitioner not found' })
  @Get('practitioners/epic/:epicId')
  async findPractitionerByEpicId(@Param('epicId') epicId: string) {
    return this.serverService.findPractitionerByEpicId(epicId);
  }

  // Observation endpoints
  @ApiOperation({ summary: 'Get observations by patient ID' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Observations retrieved successfully' })
  @Get('observations/patient/:patientId')
  async findObservationsByPatientId(@Param('patientId') patientId: string) {
    return this.serverService.findObservationsByPatientId(patientId);
  }

  // Condition endpoints
  @ApiOperation({ summary: 'Get conditions by patient ID' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Conditions retrieved successfully' })
  @Get('conditions/patient/:patientId')
  async findConditionsByPatientId(@Param('patientId') patientId: string) {
    return this.serverService.findConditionsByPatientId(patientId);
  }

  // Allergy endpoints
  @ApiOperation({ summary: 'Get allergies by patient ID' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Allergies retrieved successfully' })
  @Get('allergies/patient/:patientId')
  async findAllergiesByPatientId(@Param('patientId') patientId: string) {
    return this.serverService.findAllergiesByPatientId(patientId);
  }

  // Medication endpoints
  @ApiOperation({ summary: 'Get medications by patient ID' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Medications retrieved successfully' })
  @Get('medications/patient/:patientId')
  async findMedicationsByPatientId(@Param('patientId') patientId: string) {
    return this.serverService.findMedicationsByPatientId(patientId);
  }

  // Procedure endpoints
  @ApiOperation({ summary: 'Get procedures by patient ID' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Procedures retrieved successfully' })
  @Get('procedures/patient/:patientId')
  async findProceduresByPatientId(@Param('patientId') patientId: string) {
    return this.serverService.findProceduresByPatientId(patientId);
  }

  // Encounter endpoints
  @ApiOperation({ summary: 'Get encounters by patient ID' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Encounters retrieved successfully' })
  @Get('encounters/patient/:patientId')
  async findEncountersByPatientId(@Param('patientId') patientId: string) {
    return this.serverService.findEncountersByPatientId(patientId);
  }

  // DiagnosticReport endpoints
  @ApiOperation({ summary: 'Get diagnostic reports by patient ID' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Diagnostic reports retrieved successfully' })
  @Get('diagnostic-reports/patient/:patientId')
  async findDiagnosticReportsByPatientId(@Param('patientId') patientId: string) {
    return this.serverService.findDiagnosticReportsByPatientId(patientId);
  }

  // Sync endpoints
  @ApiOperation({
    summary: 'Sync patient data from Epic to database',
    description:
      'Fetches all patient data from Epic FHIR API and syncs it to the database. Creates or updates patient and all related clinical data (observations, conditions, allergies, medications, procedures, encounters, diagnostic reports). Automatically triggers risk rule evaluation after sync.',
  })
  @ApiParam({
    name: 'patientId',
    description: 'Epic FHIR Patient ID',
    example: 'eq081-VQEgP8drUUqCWzHfw3',
  })
  @ApiOkResponse({
    description: 'Patient data synced successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        patientId: { type: 'string', description: 'Database UUID' },
        epicId: { type: 'string', description: 'Epic FHIR Patient ID' },
        synced: {
          type: 'object',
          properties: {
            observations: { type: 'number' },
            conditions: { type: 'number' },
            allergies: { type: 'number' },
            medications: { type: 'number' },
            procedures: { type: 'number' },
            encounters: { type: 'number' },
            diagnosticReports: { type: 'number' },
          },
        },
        forbiddenScopes: {
          type: 'object',
          description: 'Scopes that are forbidden (if any)',
        },
        riskEvaluation: {
          type: 'object',
          description: 'Risk rule evaluation results (if evaluation was successful)',
          properties: {
            totalScore: { type: 'number', example: 25 },
            matchedRulesCount: { type: 'number', example: 3 },
            highestRiskLevel: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              example: 'high',
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid patient ID or patient not found in Epic',
  })
  @Post('sync/patient/:patientId')
  async syncPatientFromEpic(@Param('patientId') patientId: string) {
    return this.serverService.syncPatientFromEpic(patientId);
  }

  @ApiOperation({
    summary: 'Get high-level dashboard metrics',
    description:
      'Returns total counts for patients, encounters, observations, and procedures to support dashboard views.',
  })
  @ApiOkResponse({
    description: 'Dashboard metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalPatients: {
          type: 'number',
          example: 1234,
          description: 'Total number of patients in the system',
        },
        totalEncounters: {
          type: 'number',
          example: 5678,
          description: 'Total number of encounters across all patients',
        },
        totalObservations: {
          type: 'number',
          example: 91011,
          description: 'Total number of observations recorded',
        },
        totalProcedures: {
          type: 'number',
          example: 1213,
          description: 'Total number of procedures recorded',
        },
      },
    },
  })
  @Get('dashboard/metrics')
  async getDashboardMetrics() {
    this.logger.log('Fetching dashboard metrics');
    return this.serverService.getDashboardMetrics();
  }

  @ApiOperation({
    summary: 'Get ingestion dashboard metrics',
    description:
      'Returns total and today counts of ingested patients, encounters, observations, procedures, and other clinical records.',
  })
  @ApiOkResponse({
    description: 'Ingestion dashboard metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        overall: {
          type: 'object',
          properties: {
            patients: { type: 'number', example: 1000 },
            observations: { type: 'number', example: 5000 },
            conditions: { type: 'number', example: 1200 },
            allergies: { type: 'number', example: 300 },
            medications: { type: 'number', example: 2000 },
            procedures: { type: 'number', example: 800 },
            encounters: { type: 'number', example: 1500 },
            diagnosticReports: { type: 'number', example: 600 },
            totalRecords: {
              type: 'number',
              example: 11100,
              description: 'Sum of all overall ingestion counts',
            },
          },
        },
        today: {
          type: 'object',
          properties: {
            patients: { type: 'number', example: 10 },
            observations: { type: 'number', example: 50 },
            conditions: { type: 'number', example: 12 },
            allergies: { type: 'number', example: 3 },
            medications: { type: 'number', example: 20 },
            procedures: { type: 'number', example: 8 },
            encounters: { type: 'number', example: 15 },
            diagnosticReports: { type: 'number', example: 6 },
            totalRecords: {
              type: 'number',
              example: 124,
              description: 'Sum of all today ingestion counts',
            },
          },
        },
      },
    },
  })
  @Get('dashboard/ingestion')
  async getIngestionDashboardMetrics() {
    this.logger.log('Fetching ingestion dashboard metrics');
    return this.serverService.getIngestionDashboardMetrics();
  }

  @ApiOperation({
    summary: 'Get risk rules dashboard metrics',
    description:
      'Returns metrics about risk rules and issues (matched evaluations), including total issues count, total score, breakdown by risk level, and top rules with most issues.',
  })
  @ApiOkResponse({
    description: 'Risk rules dashboard metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalRules: {
          type: 'number',
          example: 25,
          description: 'Total number of risk rules in the system',
        },
        activeRules: {
          type: 'number',
          example: 23,
          description: 'Number of active risk rules',
        },
        totalIssues: {
          type: 'number',
          example: 150,
          description: 'Total number of matched risk evaluations (issues)',
        },
        totalScore: {
          type: 'number',
          example: 3750,
          description: 'Sum of all scores from matched evaluations',
        },
        averageScore: {
          type: 'number',
          example: 25.0,
          description: 'Average score per issue',
        },
        riskLevelBreakdown: {
          type: 'object',
          description: 'Issues grouped by risk level',
          additionalProperties: {
            type: 'object',
            properties: {
              count: { type: 'number', example: 50 },
              totalScore: { type: 'number', example: 1250 },
              averageScore: { type: 'number', example: 25.0 },
            },
          },
          example: {
            low: { count: 20, totalScore: 400, averageScore: 20.0 },
            medium: { count: 50, totalScore: 1250, averageScore: 25.0 },
            high: { count: 60, totalScore: 1800, averageScore: 30.0 },
            critical: { count: 20, totalScore: 300, averageScore: 15.0 },
          },
        },
        topRulesWithIssues: {
          type: 'array',
          description: 'Top 10 rules with the most issues',
          items: {
            type: 'object',
            properties: {
              ruleId: { type: 'string', example: 'uuid' },
              ruleName: { type: 'string', example: 'Ryan Haight Act Violation' },
              ruleCode: { type: 'string', example: 'TH-001', nullable: true },
              riskLevel: {
                type: 'string',
                example: 'high',
                enum: ['low', 'medium', 'high', 'critical'],
              },
              ruleScore: { type: 'number', example: 25 },
              issuesCount: { type: 'number', example: 45 },
              totalScore: { type: 'number', example: 1125 },
              averageScore: { type: 'number', example: 25.0 },
            },
          },
        },
      },
    },
  })
  @Get('dashboard/rules')
  async getRiskRulesDashboardMetrics() {
    this.logger.log('Fetching risk rules dashboard metrics');
    return this.serverService.getRiskRulesDashboardMetrics();
  }
}

