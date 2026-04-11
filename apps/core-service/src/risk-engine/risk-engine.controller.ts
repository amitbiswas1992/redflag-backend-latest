import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { RiskEngineService } from './risk-engine.service';
import {
  CreateRiskRuleDto,
  UpdateRiskRuleDto,
  RiskEvaluationResultDto,
  PatientRiskSummaryDto,
  EventName,
  RiskFieldNameDto,
} from './dto/risk-engine.dto';

@ApiTags('Risk Engine')
@Controller('risk-engine')
export class RiskEngineController {
  private readonly logger = new Logger(RiskEngineController.name);

  constructor(private readonly riskEngineService: RiskEngineService) {}

  // Risk Rule Management
  @ApiOperation({ summary: 'Create a new risk rule' })
  @ApiCreatedResponse({ description: 'Risk rule created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @Post('rules')
  async createRule(@Body() createRuleDto: CreateRiskRuleDto) {
    return this.riskEngineService.createRule(createRuleDto);
  }

  @ApiOperation({ summary: 'Get all risk rules' })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiOkResponse({ description: 'List of risk rules' })
  @Get('rules')
  async findAllRules(@Query('isActive') isActive?: string) {
    const activeFilter =
      isActive !== undefined ? isActive === 'true' : undefined;
    return this.riskEngineService.findAllRules(activeFilter);
  }

  @ApiOperation({ summary: 'Get risk rule by ID' })
  @ApiParam({ name: 'id', description: 'Risk rule ID' })
  @ApiOkResponse({ description: 'Risk rule details' })
  @ApiNotFoundResponse({ description: 'Risk rule not found' })
  @Get('rules/:id')
  async findRuleById(@Param('id') id: string) {
    return this.riskEngineService.findRuleById(id);
  }

  @ApiOperation({ summary: 'Get risk rules by event name' })
  @ApiParam({
    name: 'eventName',
    enum: EventName,
    description: 'Event/activity type',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiOkResponse({ description: 'List of risk rules for the event type' })
  @Get('rules/event/:eventName')
  async findRulesByEventName(
    @Param('eventName') eventName: EventName,
    @Query('isActive') isActive?: string,
  ) {
    const activeFilter =
      isActive !== undefined ? isActive === 'true' : undefined;
    return this.riskEngineService.findRulesByEventName(eventName, activeFilter);
  }

  @ApiOperation({ summary: 'Update a risk rule' })
  @ApiParam({ name: 'id', description: 'Risk rule ID' })
  @ApiOkResponse({ description: 'Risk rule updated successfully' })
  @ApiNotFoundResponse({ description: 'Risk rule not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @Put('rules/:id')
  async updateRule(
    @Param('id') id: string,
    @Body() updateRuleDto: UpdateRiskRuleDto,
  ) {
    return this.riskEngineService.updateRule(id, updateRuleDto);
  }

  @ApiOperation({ summary: 'Delete a risk rule' })
  @ApiParam({ name: 'id', description: 'Risk rule ID' })
  @ApiOkResponse({ description: 'Risk rule deleted successfully' })
  @ApiNotFoundResponse({ description: 'Risk rule not found' })
  @Delete('rules/:id')
  async deleteRule(@Param('id') id: string) {
    return this.riskEngineService.deleteRule(id);
  }

  // Rule Evaluation
  @ApiOperation({
    summary: 'Evaluate all active rules for a patient',
    description:
      'Evaluates all active risk rules against the patients latest synced data and stores the results.',
  })
  @ApiParam({ name: 'patientId', description: 'Patient ID (UUID)' })
  @ApiOkResponse({
    description: 'Evaluation results',
    type: PatientRiskSummaryDto,
  })
  @ApiNotFoundResponse({ description: 'Patient not found' })
  @Post('evaluate/patient/:patientId')
  async evaluatePatientRules(@Param('patientId') patientId: string) {
    return this.riskEngineService.evaluatePatientRules(patientId);
  }

  @ApiOperation({
    summary: 'Get patient risk summary',
    description: 'Get the latest risk evaluation summary for a patient',
  })
  @ApiParam({ name: 'patientId', description: 'Patient ID (UUID)' })
  @ApiOkResponse({
    description: 'Patient risk summary',
    type: PatientRiskSummaryDto,
  })
  @Get('patient/:patientId/summary')
  async getPatientRiskSummary(@Param('patientId') patientId: string) {
    return this.riskEngineService.getPatientRiskSummary(patientId);
  }

  @ApiOperation({
    summary: 'Get patient evaluation history',
    description: 'Get the evaluation history for a patient',
  })
  @ApiParam({ name: 'patientId', description: 'Patient ID (UUID)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of evaluations to return',
    example: 50,
  })
  @ApiOkResponse({
    description: 'Evaluation history',
    type: [RiskEvaluationResultDto],
  })
  @Get('patient/:patientId/history')
  async getPatientEvaluationHistory(
    @Param('patientId') patientId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.riskEngineService.getPatientEvaluationHistory(
      patientId,
      limitNum,
    );
  }

  @ApiOperation({
    summary: 'Get available risk rule field names (with table prefix)',
    description:
      'Returns the catalog of fields that can be referenced in risk rule conditions, including their logical table/model prefix.',
  })
  @ApiOkResponse({
    description: 'List of risk rule field definitions',
    type: [RiskFieldNameDto],
  })
  @Get('fields')
  async getRiskFieldNames(): Promise<RiskFieldNameDto[]> {
    this.logger.log('Fetching risk rule field name catalog');
    return this.riskEngineService.getRiskFieldNames();
  }
}

