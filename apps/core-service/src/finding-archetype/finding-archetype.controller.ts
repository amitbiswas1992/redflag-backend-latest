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
    ApiTags,
} from '@nestjs/swagger';
import {
    CreateFindingArchetypeDto,
    ListFindingArchetypesQuery,
    UpdateFindingArchetypeDto,
} from './dto/finding-archetype.dto';
import { FindingArchetypeService } from './finding-archetype.service';

@ApiTags('Finding Archetypes')
@Controller('finding-archetypes')
export class FindingArchetypeController {
    private readonly logger = new Logger(FindingArchetypeController.name);

    constructor(private readonly service: FindingArchetypeService) {}

    @ApiOperation({ summary: 'List finding archetypes with optional filters' })
    @ApiOkResponse({ description: 'Paginated list of finding archetypes' })
    @Get()
    list(@Query() query: ListFindingArchetypesQuery) {
        return this.service.list(query);
    }

    @ApiOperation({ summary: 'Get root archetypes (no parent)' })
    @ApiOkResponse({ description: 'List of root archetypes' })
    @Get('roots')
    getRoots() {
        return this.service.getRoots();
    }

    @ApiOperation({ summary: 'Get children of an archetype' })
    @ApiParam({ name: 'id', description: 'Parent archetype UUID' })
    @ApiOkResponse({ description: 'List of child archetypes' })
    @Get(':id/children')
    getChildren(@Param('id') id: string) {
        return this.service.getChildren(id);
    }

    @ApiOperation({ summary: 'Get a finding archetype by ID' })
    @ApiParam({ name: 'id', description: 'Archetype UUID' })
    @ApiOkResponse({ description: 'Finding archetype' })
    @ApiNotFoundResponse({ description: 'Not found' })
    @Get(':id')
    getById(@Param('id') id: string) {
        return this.service.getById(id);
    }

    @ApiOperation({ summary: 'Create a finding archetype' })
    @ApiCreatedResponse({ description: 'Archetype created' })
    @ApiBadRequestResponse({ description: 'Invalid input' })
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Post()
    create(@Body() dto: CreateFindingArchetypeDto) {
        return this.service.create(dto);
    }

    @ApiOperation({ summary: 'Update a finding archetype' })
    @ApiParam({ name: 'id', description: 'Archetype UUID' })
    @ApiOkResponse({ description: 'Archetype updated' })
    @ApiNotFoundResponse({ description: 'Not found' })
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Put(':id')
    update(@Param('id') id: string, @Body() dto: UpdateFindingArchetypeDto) {
        return this.service.update(id, dto);
    }

    @ApiOperation({ summary: 'Delete a finding archetype' })
    @ApiParam({ name: 'id', description: 'Archetype UUID' })
    @ApiOkResponse({ description: 'Archetype deleted' })
    @ApiNotFoundResponse({ description: 'Not found' })
    @ApiBadRequestResponse({ description: 'Has child archetypes' })
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.service.delete(id);
    }
}
