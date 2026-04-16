import { RBAC_ROLES, Roles } from '@app/common';
import {
    Body,
    Controller,
    DefaultValuePipe,
    Get,
    HttpCode,
    HttpStatus,
    MessageEvent,
    Param,
    ParseIntPipe,
    Post,
    Query,
    Sse,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { IngestionService } from './ingestion.service';

@ApiTags('Data Ingestion')
@Controller(['api/ingestion', 'api/ingestion/v2'])
export class IngestionController {
    constructor(private readonly ingestionService: IngestionService) { }

    @ApiOperation({
        summary: 'Create ingestion v2 job',
        description: 'Creates a new strict flat-FHIR CSV ingestion job with Zod-validated request payload.',
    })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['sourceType'],
            properties: {
                sourceType: { type: 'string', enum: ['FLAT_FHIR_CSV'] },
                templateVersion: { type: 'string' },
                mappingManifest: { type: 'object' },
            },
        },
    })
    @ApiOkResponse({ description: 'Ingestion job created' })
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Post('jobs')
    @HttpCode(HttpStatus.CREATED)
    async createJob(@Body() body: unknown) {
        return this.ingestionService.createJob(body);
    }

    @ApiOperation({
        summary: 'Upload CSV payload to job',
        description:
            'Uploads raw CSV text and performs strict row/date normalization checks. This endpoint stores row-level validation outcomes.',
    })
    @ApiParam({ name: 'jobId', description: 'Ingestion job ID' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['csvData'],
            properties: {
                csvData: { type: 'string' },
            },
        },
    })
    @ApiOkResponse({ description: 'CSV accepted and validated' })
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Post('jobs/:jobId/upload-csv')
    async uploadCsv(@Param('jobId') jobId: string, @Body() body: unknown) {
        return this.ingestionService.uploadCsv(jobId, body);
    }

    @ApiOperation({
        summary: 'Start ingestion job',
        description: 'Transitions an UPLOADED job into RUNNING and enqueues async processing.',
    })
    @ApiParam({ name: 'jobId', description: 'Ingestion job ID' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                strictDateParsing: { type: 'boolean', default: true },
            },
        },
    })
    @ApiOkResponse({ description: 'Job started' })
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Post('jobs/:jobId/start')
    @HttpCode(HttpStatus.ACCEPTED)
    async startJob(@Param('jobId') jobId: string, @Body() body: unknown) {
        return this.ingestionService.startJob(jobId, body);
    }

    @ApiOperation({ summary: 'Get job status' })
    @ApiParam({ name: 'jobId', description: 'Ingestion job ID' })
    @ApiOkResponse({ description: 'Job status returned' })
    @Get('jobs/:jobId')
    async getJobStatus(@Param('jobId') jobId: string) {
        return this.ingestionService.getJobStatus(jobId);
    }

    @ApiOperation({ summary: 'Get job progress snapshot' })
    @ApiParam({ name: 'jobId', description: 'Ingestion job ID' })
    @ApiOkResponse({ description: 'Job progress returned' })
    @Get('jobs/:jobId/progress')
    async getJobProgress(@Param('jobId') jobId: string) {
        return this.ingestionService.getJobProgress(jobId);
    }

    @ApiOperation({ summary: 'Stream job progress events' })
    @ApiParam({ name: 'jobId', description: 'Ingestion job ID' })
    @Sse('jobs/:jobId/progress/stream')
    streamJobProgress(
        @Param('jobId') jobId: string,
    ): Observable<MessageEvent> {
        return this.ingestionService.streamJobProgress(jobId);
    }

    @ApiOperation({ summary: 'Stream job events (SSE alias)' })
    @ApiParam({ name: 'jobId', description: 'Ingestion job ID' })
    @Sse('jobs/:jobId/events')
    streamJobEvents(
        @Param('jobId') jobId: string,
    ): Observable<MessageEvent> {
        return this.ingestionService.streamJobProgress(jobId);
    }

    @ApiOperation({
        summary: 'Confirm detected template and mark job upload-ready',
        description: 'Transitions AWAITING_CONFIRMATION jobs into UPLOADED.',
    })
    @ApiParam({ name: 'jobId', description: 'Ingestion job ID' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                acceptedTemplate: { type: 'string' },
                mappingManifest: { type: 'object' },
            },
        },
    })
    @ApiOkResponse({ description: 'Template confirmed and job is ready to start' })
    @Roles(RBAC_ROLES.OWNER, RBAC_ROLES.ADMIN)
    @Post('jobs/:jobId/confirm-template')
    async confirmTemplate(@Param('jobId') jobId: string, @Body() body: unknown) {
        return this.ingestionService.confirmTemplate(jobId, body);
    }

    @ApiOperation({ summary: 'Get row-level results' })
    @ApiParam({ name: 'jobId', description: 'Ingestion job ID' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'pageSize', required: false, type: Number })
    @ApiOkResponse({ description: 'Paginated row-level results' })
    @Get('jobs/:jobId/results')
    async getRowResults(
        @Param('jobId') jobId: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('pageSize', new DefaultValuePipe(50), ParseIntPipe) pageSize: number,
    ) {
        return this.ingestionService.getRowResults(jobId, page, pageSize);
    }
}
