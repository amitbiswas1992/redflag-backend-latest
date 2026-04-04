import {
    Body,
    Controller,
    DefaultValuePipe,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IngestionV2Service } from './ingestion-v2.service';

@ApiTags('Data Ingestion V2')
@Controller('api/ingestion/v2')
export class IngestionV2Controller {
    constructor(private readonly ingestionV2Service: IngestionV2Service) { }

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
    @Post('jobs')
    @HttpCode(HttpStatus.CREATED)
    async createJob(@Body() body: unknown) {
        return this.ingestionV2Service.createJob(body);
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
    @Post('jobs/:jobId/upload-csv')
    async uploadCsv(@Param('jobId') jobId: string, @Body() body: unknown) {
        return this.ingestionV2Service.uploadCsv(jobId, body);
    }

    @ApiOperation({
        summary: 'Start ingestion job',
        description: 'Transitions an UPLOADED job into RUNNING and then COMPLETED for phase 1 foundation flow.',
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
    @Post('jobs/:jobId/start')
    async startJob(@Param('jobId') jobId: string, @Body() body: unknown) {
        return this.ingestionV2Service.startJob(jobId, body);
    }

    @ApiOperation({ summary: 'Get job status' })
    @ApiParam({ name: 'jobId', description: 'Ingestion job ID' })
    @ApiOkResponse({ description: 'Job status returned' })
    @Get('jobs/:jobId')
    async getJobStatus(@Param('jobId') jobId: string) {
        return this.ingestionV2Service.getJobStatus(jobId);
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
        return this.ingestionV2Service.getRowResults(jobId, page, pageSize);
    }
}
