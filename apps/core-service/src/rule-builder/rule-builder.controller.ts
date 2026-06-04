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
    HttpCode,
    HttpStatus,
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
    CreateRiskRuleDto,
    CreateRuleCategoryDto,
    Severity,
    TargetTable,
    UpdateFlagDto,
    UpdateRiskRuleDto,
    UpdateRuleCategoryDto,
} from './dto/rule-builder.dto';
import { RuleBuilderService } from './rule-builder.service';

@ApiTags('Rule Builder')
@Controller('rule-builder')
export class RuleBuilderController {
    private readonly logger = new Logger(RuleBuilderController.name);

    constructor(private readonly service: RuleBuilderService) { }

    // ── Table metadata (UI condition builder) ─────────────────────────────────

    @ApiOperation({
        summary: 'Get available analytics tables and their queryable columns',
        description:
            'Returns the catalog of target tables with column metadata for the frontend condition builder.',
    })
    @ApiOkResponse({ description: 'Table catalog with column definitions' })
    @Get('tables')
    getTableCatalog() {
        return this.service.getTableCatalog();
    }

    // ── Categories ────────────────────────────────────────────────────────────

    @ApiOperation({ summary: 'List all finding categories' })
    @ApiOkResponse({ description: 'List of rule categories' })
    @Get('categories')
    listCategories() {
        return this.service.listCategories();
    }

    @ApiOperation({ summary: 'Create a finding category' })
    @ApiCreatedResponse({ description: 'Category created' })
    @ApiBadRequestResponse({ description: 'Invalid input' })
    @OrgRoles(['owner', 'admin'])
    @Post('categories')
    createCategory(@Body() dto: CreateRuleCategoryDto) {
        return this.service.createCategory(dto);
    }

    @ApiOperation({ summary: 'Update a finding category' })
    @ApiOkResponse({ description: 'Category updated' })
    @ApiNotFoundResponse({ description: 'Category not found' })
    @OrgRoles(['owner', 'admin'])
    @Put('categories/:id')
    updateCategory(@Param('id') id: string, @Body() dto: UpdateRuleCategoryDto) {
        return this.service.updateCategory(id, dto);
    }

    @ApiOperation({ summary: 'Delete a finding category' })
    @ApiOkResponse({ description: 'Category deleted' })
    @ApiNotFoundResponse({ description: 'Category not found' })
    @ApiBadRequestResponse({ description: 'Cannot delete — rules still assigned' })
    @OrgRoles(['owner', 'admin'])
    @Delete('categories/:id')
    deleteCategory(@Param('id') id: string) {
        return this.service.deleteCategory(id);
    }

    // ── Rules ─────────────────────────────────────────────────────────────────

    @ApiOperation({ summary: 'List all rules' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'severity', required: false, enum: Severity })
    @ApiQuery({ name: 'isActive', required: false, type: Boolean })
    @ApiQuery({ name: 'categoryId', required: false, type: String })
    @ApiQuery({ name: 'targetTable', required: false, enum: TargetTable })
    @ApiOkResponse({ description: 'List of rules with embedded conditions' })
    @Get('rules')
    listRules(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('severity') severity?: Severity,
        @Query('isActive') isActive?: string,
        @Query('categoryId') categoryId?: string,
        @Query('targetTable') targetTable?: TargetTable,
    ) {
        const parsedPage = page ? Number.parseInt(page, 10) : undefined;
        const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;

        return this.service.listRules({
            page: Number.isFinite(parsedPage) ? parsedPage : undefined,
            limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
            search,
            severity,
            isActive: isActive !== undefined ? isActive === 'true' : undefined,
            categoryId,
            targetTable,
        });
    }

    @ApiOperation({ summary: 'Get a rule by ID' })
    @ApiParam({ name: 'id', description: 'Rule UUID' })
    @ApiOkResponse({ description: 'Rule with embedded conditions' })
    @ApiNotFoundResponse({ description: 'Rule not found' })
    @Get('rules/:id')
    getRuleById(@Param('id') id: string) {
        return this.service.getRuleById(id);
    }

    @ApiOperation({ summary: 'Create a new rule with conditions' })
    @ApiCreatedResponse({ description: 'Rule created' })
    @ApiBadRequestResponse({ description: 'Invalid field names or input' })
    @OrgRoles(['owner', 'admin'])
    @Post('rules')
    createRule(@Body() dto: CreateRiskRuleDto) {
        return this.service.createRule(dto);
    }

    @ApiOperation({ summary: 'Update a rule and replace its conditions' })
    @ApiParam({ name: 'id', description: 'Rule UUID' })
    @ApiOkResponse({ description: 'Rule updated' })
    @ApiNotFoundResponse({ description: 'Rule not found' })
    @OrgRoles(['owner', 'admin'])
    @Put('rules/:id')
    updateRule(@Param('id') id: string, @Body() dto: UpdateRiskRuleDto) {
        return this.service.updateRule(id, dto);
    }

    @ApiOperation({ summary: 'Toggle rule active/inactive' })
    @ApiParam({ name: 'id', description: 'Rule UUID' })
    @ApiOkResponse({ description: 'Rule toggled' })
    @OrgRoles(['owner', 'admin'])
    @Patch('rules/:id/toggle')
    toggleRule(@Param('id') id: string) {
        return this.service.toggleRule(id);
    }

    @ApiOperation({ summary: 'Delete a rule' })
    @ApiParam({ name: 'id', description: 'Rule UUID' })
    @ApiOkResponse({ description: 'Rule deleted' })
    @ApiNotFoundResponse({ description: 'Rule not found' })
    @OrgRoles(['owner', 'admin'])
    @Delete('rules/:id')
    deleteRule(@Param('id') id: string) {
        return this.service.deleteRule(id);
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────

    @ApiOperation({ summary: 'Dashboard stats — avg risk score, top flag with score factors, and trend flag list' })
    @ApiOkResponse({ description: 'Aggregated dashboard data for the overview page' })
    @Get('dashboard')
    getDashboardStats() {
        return this.service.getDashboardStats();
    }

    // ── Compliance Flags ──────────────────────────────────────────────────────

    @ApiOperation({ summary: 'Flag statistics — counts by severity, status, and SLA breaches' })
    @ApiOkResponse({ description: 'Aggregated flag counts for the dashboard stats row' })
    @Get('flags/stats')
    getFlagStats() {
        return this.service.getFlagStats();
    }

    @ApiOperation({ summary: 'List compliance flags (paginated, with rule / archetype / plan)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'entityId', required: false, type: String })
    @ApiQuery({ name: 'ruleId', required: false, type: String })
    @ApiQuery({ name: 'severity', required: false, type: String })
    @ApiQuery({ name: 'status', required: false, type: String, description: 'open | in_progress | pending_validation | completed' })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by instance ID or rule name/code' })
    @ApiQuery({ name: 'sort', required: false, type: String, description: 'risk_desc | risk_asc | created_desc | created_asc' })
    @ApiOkResponse({ description: 'Paginated compliance flags with embedded rule, finding_archetype, and risk_management_plan' })
    @Get('flags')
    listFlags(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('entityId') entityId?: string,
        @Query('ruleId') ruleId?: string,
        @Query('severity') severity?: string,
        @Query('status') status?: string,
        @Query('search') search?: string,
        @Query('sort') sort?: string,
    ) {
        const parsedPage = page ? Number.parseInt(page, 10) : undefined;
        const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
        return this.service.listFlags({
            page: Number.isFinite(parsedPage) ? parsedPage : undefined,
            limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
            entityId,
            ruleId,
            severity,
            status,
            search,
            sort,
        });
    }

    @ApiOperation({ summary: 'Get a compliance flag by instance ID (e.g. FND-001)' })
    @ApiParam({ name: 'instanceId', description: 'Flag instance ID string' })
    @ApiOkResponse({ description: 'Flag with rule, archetype, plan, patient, and org tuning' })
    @ApiNotFoundResponse({ description: 'Flag not found' })
    @Get('flags/:instanceId')
    getFlagByInstanceId(@Param('instanceId') instanceId: string) {
        return this.service.getFlagByInstanceId(instanceId);
    }

    @ApiOperation({ summary: 'Update a compliance flag (scoreFactorsOverride)' })
    @ApiParam({ name: 'id', description: 'Flag UUID' })
    @ApiOkResponse({ description: 'Updated compliance flag' })
    @ApiNotFoundResponse({ description: 'Flag not found' })
    @HttpCode(HttpStatus.OK)
    @Patch('flags/:id')
    updateFlag(@Param('id') id: string, @Body() dto: UpdateFlagDto) {
        return this.service.updateFlag(id, dto);
    }

    @ApiOperation({ summary: 'Get findings grouped by rule with flag counts' })
    @ApiOkResponse({ description: 'Rules with aggregated flag counts and latest detection dates' })
    @Get('findings')
    getFindingsByRule() {
        return this.service.getFindingsByRule();
    }

    @ApiOperation({ summary: 'Get individual flags for a rule with patient details' })
    @ApiParam({ name: 'ruleId', description: 'Rule UUID' })
    @ApiOkResponse({ description: 'List of compliance flags with patient data' })
    @Get('findings/:ruleId')
    getFindingsDetail(@Param('ruleId') ruleId: string) {
        return this.service.getFindingsDetail(ruleId);
    }
}
