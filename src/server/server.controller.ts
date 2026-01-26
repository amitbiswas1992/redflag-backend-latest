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
  ApiTags,
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
  CreateObservationDto,
  CreateConditionDto,
  CreateAllergyDto,
  CreateMedicationDto,
  CreateProcedureDto,
  CreateEncounterDto,
  CreateDiagnosticReportDto,
} from './dto/server.dto';

@ApiTags('Server')
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
  @ApiOkResponse({ description: 'List of patients retrieved successfully' })
  @Get('patients')
  async findAllPatients(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.serverService.findAllPatients(
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 10,
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
  @ApiOperation({ summary: 'Create a new observation' })
  @ApiBody({ type: CreateObservationDto })
  @ApiCreatedResponse({ description: 'Observation created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @Post('observations')
  async createObservation(@Body() createObservationDto: CreateObservationDto) {
    return this.serverService.createObservation(createObservationDto);
  }

  @ApiOperation({ summary: 'Get observations by patient ID' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Observations retrieved successfully' })
  @Get('observations/patient/:patientId')
  async findObservationsByPatientId(@Param('patientId') patientId: string) {
    return this.serverService.findObservationsByPatientId(patientId);
  }

  // Condition endpoints
  @ApiOperation({ summary: 'Create a new condition' })
  @ApiBody({ type: CreateConditionDto })
  @ApiCreatedResponse({ description: 'Condition created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @Post('conditions')
  async createCondition(@Body() createConditionDto: CreateConditionDto) {
    return this.serverService.createCondition(createConditionDto);
  }

  @ApiOperation({ summary: 'Get conditions by patient ID' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Conditions retrieved successfully' })
  @Get('conditions/patient/:patientId')
  async findConditionsByPatientId(@Param('patientId') patientId: string) {
    return this.serverService.findConditionsByPatientId(patientId);
  }

  // Allergy endpoints
  @ApiOperation({ summary: 'Create a new allergy' })
  @ApiBody({ type: CreateAllergyDto })
  @ApiCreatedResponse({ description: 'Allergy created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @Post('allergies')
  async createAllergy(@Body() createAllergyDto: CreateAllergyDto) {
    return this.serverService.createAllergy(createAllergyDto);
  }

  @ApiOperation({ summary: 'Get allergies by patient ID' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Allergies retrieved successfully' })
  @Get('allergies/patient/:patientId')
  async findAllergiesByPatientId(@Param('patientId') patientId: string) {
    return this.serverService.findAllergiesByPatientId(patientId);
  }

  // Medication endpoints
  @ApiOperation({ summary: 'Create a new medication' })
  @ApiBody({ type: CreateMedicationDto })
  @ApiCreatedResponse({ description: 'Medication created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @Post('medications')
  async createMedication(@Body() createMedicationDto: CreateMedicationDto) {
    return this.serverService.createMedication(createMedicationDto);
  }

  @ApiOperation({ summary: 'Get medications by patient ID' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Medications retrieved successfully' })
  @Get('medications/patient/:patientId')
  async findMedicationsByPatientId(@Param('patientId') patientId: string) {
    return this.serverService.findMedicationsByPatientId(patientId);
  }

  // Procedure endpoints
  @ApiOperation({ summary: 'Create a new procedure' })
  @ApiBody({ type: CreateProcedureDto })
  @ApiCreatedResponse({ description: 'Procedure created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @Post('procedures')
  async createProcedure(@Body() createProcedureDto: CreateProcedureDto) {
    return this.serverService.createProcedure(createProcedureDto);
  }

  @ApiOperation({ summary: 'Get procedures by patient ID' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Procedures retrieved successfully' })
  @Get('procedures/patient/:patientId')
  async findProceduresByPatientId(@Param('patientId') patientId: string) {
    return this.serverService.findProceduresByPatientId(patientId);
  }

  // Encounter endpoints
  @ApiOperation({ summary: 'Create a new encounter' })
  @ApiBody({ type: CreateEncounterDto })
  @ApiCreatedResponse({ description: 'Encounter created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @Post('encounters')
  async createEncounter(@Body() createEncounterDto: CreateEncounterDto) {
    return this.serverService.createEncounter(createEncounterDto);
  }

  @ApiOperation({ summary: 'Get encounters by patient ID' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Encounters retrieved successfully' })
  @Get('encounters/patient/:patientId')
  async findEncountersByPatientId(@Param('patientId') patientId: string) {
    return this.serverService.findEncountersByPatientId(patientId);
  }

  // DiagnosticReport endpoints
  @ApiOperation({ summary: 'Create a new diagnostic report' })
  @ApiBody({ type: CreateDiagnosticReportDto })
  @ApiCreatedResponse({ description: 'Diagnostic report created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @Post('diagnostic-reports')
  async createDiagnosticReport(
    @Body() createDiagnosticReportDto: CreateDiagnosticReportDto,
  ) {
    return this.serverService.createDiagnosticReport(createDiagnosticReportDto);
  }

  @ApiOperation({ summary: 'Get diagnostic reports by patient ID' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'Diagnostic reports retrieved successfully' })
  @Get('diagnostic-reports/patient/:patientId')
  async findDiagnosticReportsByPatientId(@Param('patientId') patientId: string) {
    return this.serverService.findDiagnosticReportsByPatientId(patientId);
  }
}

