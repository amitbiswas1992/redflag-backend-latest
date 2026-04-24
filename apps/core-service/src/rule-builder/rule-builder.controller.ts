import { RBAC_ROLES, Roles } from '@app/common';
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
    TargetTable,
    UpdateRiskRuleDto,
    UpdateRuleCategoryDto,
} from './dto/rule-builder.dto';
import { RuleBuilderService } from './rule-builder.service';

@ApiTags('Rule Builder')
@Controller('rule-builder')
export class RuleBuilderController {
    private readonly logger = new Logger(RuleBuilderController.name);

    constructor(private readonly service: RuleBuilderService) {}

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
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Post('categories')
    createCategory(@Body() dto: CreateRuleCategoryDto) {
        return this.service.createCategory(dto);
    }

    @ApiOperation({ summary: 'Update a finding category' })
    @ApiOkResponse({ description: 'Category updated' })
    @ApiNotFoundResponse({ description: 'Category not found' })
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Put('categories/:id')
    updateCategory(@Param('id') id: string, @Body() dto: UpdateRuleCategoryDto) {
        return this.service.updateCategory(id, dto);
    }

    @ApiOperation({ summary: 'Delete a finding category' })
    @ApiOkResponse({ description: 'Category deleted' })
    @ApiNotFoundResponse({ description: 'Category not found' })
    @ApiBadRequestResponse({ description: 'Cannot delete — rules still assigned' })
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Delete('categories/:id')
    deleteCategory(@Param('id') id: string) {
        return this.service.deleteCategory(id);
    }

    // ── Rules ─────────────────────────────────────────────────────────────────

    @ApiOperation({ summary: 'List all rules' })
    @ApiQuery({ name: 'isActive', required: false, type: Boolean })
    @ApiQuery({ name: 'categoryId', required: false, type: String })
    @ApiQuery({ name: 'targetTable', required: false, enum: TargetTable })
    @ApiOkResponse({ description: 'List of rules with embedded conditions' })
    @Get('rules')
    listRules(
        @Query('isActive') isActive?: string,
        @Query('categoryId') categoryId?: string,
        @Query('targetTable') targetTable?: TargetTable,
    ) {
        return this.service.listRules({
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
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Post('rules')
    createRule(@Body() dto: CreateRiskRuleDto) {
        return this.service.createRule(dto);
    }

    @ApiOperation({ summary: 'Update a rule and replace its conditions' })
    @ApiParam({ name: 'id', description: 'Rule UUID' })
    @ApiOkResponse({ description: 'Rule updated' })
    @ApiNotFoundResponse({ description: 'Rule not found' })
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Put('rules/:id')
    updateRule(@Param('id') id: string, @Body() dto: UpdateRiskRuleDto) {
        return this.service.updateRule(id, dto);
    }

    @ApiOperation({ summary: 'Toggle rule active/inactive' })
    @ApiParam({ name: 'id', description: 'Rule UUID' })
    @ApiOkResponse({ description: 'Rule toggled' })
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Patch('rules/:id/toggle')
    toggleRule(@Param('id') id: string) {
        return this.service.toggleRule(id);
    }

    @ApiOperation({ summary: 'Delete a rule' })
    @ApiParam({ name: 'id', description: 'Rule UUID' })
    @ApiOkResponse({ description: 'Rule deleted' })
    @ApiNotFoundResponse({ description: 'Rule not found' })
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Delete('rules/:id')
    deleteRule(@Param('id') id: string) {
        return this.service.deleteRule(id);
    }

    // ── Compliance Flags ──────────────────────────────────────────────────────

    @ApiOperation({ summary: 'List compliance flags' })
    @ApiQuery({ name: 'entityId', required: false, type: String })
    @ApiQuery({ name: 'ruleId', required: false, type: String })
    @ApiQuery({ name: 'severity', required: false, type: String })
    @ApiOkResponse({ description: 'List of compliance flags with violation context' })
    @Get('flags')
    listFlags(
        @Query('entityId') entityId?: string,
        @Query('ruleId') ruleId?: string,
        @Query('severity') severity?: string,
    ) {
        return this.service.listFlags({ entityId, ruleId, severity });
    }
}
