import { OrgRoles } from '@thallesp/nestjs-better-auth';
import {
    Body,
    Controller,
    Delete,
    Get,
    Logger,
    Param,
    Patch,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import {
    CreateRiskManagementPlanDto,
    CreateRiskManagementPlanMessageDto,
    PlanStatus,
    RiskManagementPlanType,
    RootCauseType,
    UpdateRiskManagementPlanDto,
    UpdateRiskManagementPlanStatusDto,
} from './dto/risk-management.dto';
import { RiskManagementService } from './risk-management.service';

@ApiTags('Risk Management')
@Controller('risk-management')
export class RiskManagementController {
    private readonly logger = new Logger(RiskManagementController.name);

    constructor(private readonly service: RiskManagementService) {}

    @ApiOperation({ summary: 'List all risk management plans' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'riskRuleId', required: false, type: String })
    @ApiQuery({ name: 'rootCauseType', required: false, enum: RootCauseType })
    @ApiQuery({ name: 'type', required: false, enum: RiskManagementPlanType })
    @ApiQuery({ name: 'status', required: false, enum: PlanStatus })
    @ApiOkResponse({ description: 'Paginated list of accessible risk management plans' })
    @Get('plans')
    listPlans(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('riskRuleId') riskRuleId?: string,
        @Query('rootCauseType') rootCauseType?: RootCauseType,
        @Query('type') type?: RiskManagementPlanType,
        @Query('status') status?: PlanStatus,
    ) {
        return this.service.listPlans({
            page: page ? Number.parseInt(page, 10) : undefined,
            limit: limit ? Number.parseInt(limit, 10) : undefined,
            riskRuleId,
            rootCauseType,
            type,
            status,
        });
    }

    @ApiOperation({ summary: 'Get a risk management plan by ID' })
    @ApiParam({ name: 'id', description: 'Plan UUID' })
    @ApiOkResponse({ description: 'Risk management plan with relations' })
    @ApiNotFoundResponse({ description: 'Plan not found' })
    @ApiForbiddenResponse({ description: 'Access denied' })
    @Get('plans/:id')
    getPlanById(@Param('id') id: string) {
        return this.service.getPlanById(id);
    }

    @ApiOperation({ summary: 'Create a new risk management plan' })
    @ApiCreatedResponse({ description: 'Plan created' })
    @ApiBadRequestResponse({ description: 'Invalid input' })
    @OrgRoles(['owner', 'admin'])
    @Post('plans')
    createPlan(@Body() dto: CreateRiskManagementPlanDto) {
        return this.service.createPlan(dto);
    }

    @ApiOperation({ summary: 'Update a risk management plan' })
    @ApiParam({ name: 'id', description: 'Plan UUID' })
    @ApiOkResponse({ description: 'Plan updated' })
    @ApiNotFoundResponse({ description: 'Plan not found' })
    @OrgRoles(['owner', 'admin'])
    @Put('plans/:id')
    updatePlan(@Param('id') id: string, @Body() dto: UpdateRiskManagementPlanDto) {
        return this.service.updatePlan(id, dto);
    }

    @ApiOperation({ summary: 'Delete a risk management plan' })
    @ApiParam({ name: 'id', description: 'Plan UUID' })
    @ApiOkResponse({ description: 'Plan deleted' })
    @ApiNotFoundResponse({ description: 'Plan not found' })
    @OrgRoles(['owner', 'admin'])
    @Delete('plans/:id')
    deletePlan(@Param('id') id: string) {
        return this.service.deletePlan(id);
    }

    @ApiOperation({ summary: 'Update plan status (assignees only)' })
    @ApiParam({ name: 'id', description: 'Plan UUID' })
    @ApiOkResponse({ description: 'Status updated' })
    @ApiNotFoundResponse({ description: 'Plan not found' })
    @ApiForbiddenResponse({ description: 'Only assignees can update status' })
    @Patch('plans/:id/status')
    updatePlanStatus(@Param('id') id: string, @Body() dto: UpdateRiskManagementPlanStatusDto) {
        return this.service.updatePlanStatus(id, dto);
    }

    // ── Messages ──────────────────────────────────────────────────────────────

    @ApiOperation({ summary: 'List messages for a risk management plan' })
    @ApiParam({ name: 'id', description: 'Plan UUID' })
    @ApiOkResponse({ description: 'List of messages (accessible to admin, creator, assignees)' })
    @ApiForbiddenResponse({ description: 'Access denied' })
    @Get('plans/:id/messages')
    listMessages(@Param('id') id: string) {
        return this.service.listMessages(id);
    }

    @ApiOperation({ summary: 'Post a message on a risk management plan' })
    @ApiParam({ name: 'id', description: 'Plan UUID' })
    @ApiCreatedResponse({ description: 'Message created; plan status updated automatically' })
    @ApiForbiddenResponse({ description: 'Access denied' })
    @Post('plans/:id/messages')
    createMessage(@Param('id') id: string, @Body() dto: CreateRiskManagementPlanMessageDto) {
        return this.service.createMessage(id, dto);
    }
}
