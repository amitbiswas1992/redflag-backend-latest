import { RBAC_ROLES, Roles } from '@app/common';
import {
    Body,
    Controller,
    Delete,
    Get,
    Logger,
    Param,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import {
    CreateRiskManagementPlanDto,
    RiskManagementPlanType,
    RootCauseType,
    UpdateRiskManagementPlanDto,
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
    @ApiOkResponse({ description: 'Paginated list of risk management plans' })
    @Get('plans')
    listPlans(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('riskRuleId') riskRuleId?: string,
        @Query('rootCauseType') rootCauseType?: RootCauseType,
        @Query('type') type?: RiskManagementPlanType,
    ) {
        return this.service.listPlans({
            page: page ? Number.parseInt(page, 10) : undefined,
            limit: limit ? Number.parseInt(limit, 10) : undefined,
            riskRuleId,
            rootCauseType,
            type,
        });
    }

    @ApiOperation({ summary: 'Get a risk management plan by ID' })
    @ApiParam({ name: 'id', description: 'Plan UUID' })
    @ApiOkResponse({ description: 'Risk management plan with relations' })
    @ApiNotFoundResponse({ description: 'Plan not found' })
    @Get('plans/:id')
    getPlanById(@Param('id') id: string) {
        return this.service.getPlanById(id);
    }

    @ApiOperation({ summary: 'Create a new risk management plan' })
    @ApiCreatedResponse({ description: 'Plan created' })
    @ApiBadRequestResponse({ description: 'Invalid input' })
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Post('plans')
    createPlan(@Body() dto: CreateRiskManagementPlanDto) {
        return this.service.createPlan(dto);
    }

    @ApiOperation({ summary: 'Update a risk management plan' })
    @ApiParam({ name: 'id', description: 'Plan UUID' })
    @ApiOkResponse({ description: 'Plan updated' })
    @ApiNotFoundResponse({ description: 'Plan not found' })
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Put('plans/:id')
    updatePlan(@Param('id') id: string, @Body() dto: UpdateRiskManagementPlanDto) {
        return this.service.updatePlan(id, dto);
    }

    @ApiOperation({ summary: 'Delete a risk management plan' })
    @ApiParam({ name: 'id', description: 'Plan UUID' })
    @ApiOkResponse({ description: 'Plan deleted' })
    @ApiNotFoundResponse({ description: 'Plan not found' })
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Delete('plans/:id')
    deletePlan(@Param('id') id: string) {
        return this.service.deletePlan(id);
    }
}
