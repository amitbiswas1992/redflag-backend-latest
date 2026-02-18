import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { IngestionService } from './ingestion.service';
import { XmlParserService } from './xml-parser.service';
import {
  IngestFhirJsonDto,
  IngestFhirXmlDto,
  IngestionResponseDto,
  BulkIngestDto,
} from './dto/ingestion.dto';

@ApiTags('Data Ingestion')
@Controller('api/ingestion')
export class IngestionController {
  private readonly logger = new Logger(IngestionController.name);

  constructor(
    private readonly ingestionService: IngestionService,
    private readonly xmlParserService: XmlParserService,
  ) {}

  /**
   * POST /api/ingestion/fhir/json
   * Ingest FHIR data in JSON format
   */
  @ApiOperation({
    summary: 'Ingest FHIR data (JSON format)',
    description:
      'Accepts HL7 FHIR R4 data in JSON format. Supports single resources or bundles. Automatically normalizes and stores data in the database, then triggers risk rule evaluation.',
  })
  @ApiBody({
    description: 'FHIR resource or bundle in JSON format',
    type: IngestFhirJsonDto,
  })
  @ApiOkResponse({
    description: 'FHIR data ingested successfully',
    type: IngestionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid FHIR data or missing required fields',
  })
  @Post('fhir/json')
  @HttpCode(HttpStatus.OK)
  async ingestFhirJson(
    @Body() body: IngestFhirJsonDto,
  ): Promise<IngestionResponseDto> {
    if (!body.fhirData) {
      throw new BadRequestException('fhirData is required');
    }

    try {
      this.logger.log('Received FHIR JSON ingestion request');
      const result = await this.ingestionService.ingestFhirJson(body.fhirData);
      this.logger.log(
        `Successfully ingested FHIR JSON data for patient: ${result.patientId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error ingesting FHIR JSON: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * POST /api/ingestion/fhir/xml
   * Ingest FHIR data in XML format
   */
  @ApiOperation({
    summary: 'Ingest FHIR data (XML format)',
    description:
      'Accepts HL7 FHIR R4 data in XML format. The XML is parsed and converted to JSON, then processed the same way as JSON ingestion. Supports single resources or bundles.',
  })
  @ApiConsumes('application/xml', 'text/xml', 'application/fhir+xml')
  @ApiBody({
    description: 'FHIR resource or bundle in XML format (HL7 FHIR standard)',
    type: IngestFhirXmlDto,
    examples: {
      patient: {
        summary: 'Patient resource in XML',
        value: {
          xmlData: `<?xml version="1.0" encoding="UTF-8"?>
<Patient xmlns="http://hl7.org/fhir">
  <id value="example-patient-id"/>
  <name>
    <family value="Doe"/>
    <given value="John"/>
  </name>
  <birthDate value="1990-01-01"/>
  <gender value="male"/>
</Patient>`,
        },
      },
      bundle: {
        summary: 'Bundle with multiple resources',
        value: {
          xmlData: `<?xml version="1.0" encoding="UTF-8"?>
<Bundle xmlns="http://hl7.org/fhir">
  <type value="collection"/>
  <entry>
    <resource>
      <Patient>
        <id value="example-patient-id"/>
        <name>
          <family value="Doe"/>
          <given value="John"/>
        </name>
      </Patient>
    </resource>
  </entry>
</Bundle>`,
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'FHIR XML data ingested successfully',
    type: IngestionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid FHIR XML data or parsing error',
  })
  @Post('fhir/xml')
  @HttpCode(HttpStatus.OK)
  async ingestFhirXml(
    @Body() body: IngestFhirXmlDto,
  ): Promise<IngestionResponseDto> {
    if (!body.xmlData) {
      throw new BadRequestException('xmlData is required');
    }

    try {
      this.logger.log('Received FHIR XML ingestion request');

      // Parse XML to JSON
      const fhirJson = await this.xmlParserService.parseFhirXml(body.xmlData);
      this.logger.log('Successfully parsed FHIR XML to JSON');

      // Ingest the parsed JSON data
      const result = await this.ingestionService.ingestFhirJson(fhirJson);
      this.logger.log(
        `Successfully ingested FHIR XML data for patient: ${result.patientId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error ingesting FHIR XML: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * POST /api/ingestion/bulk
   * Bulk ingest data using simplified structure
   */
  @ApiOperation({
    summary: 'Bulk ingest patient data (simplified structure)',
    description:
      'Accepts patient data in a simplified, flat structure. Easier to use than FHIR format for bulk data insertion. Automatically normalizes and stores data in the database, then triggers risk rule evaluation.',
  })
  @ApiBody({
    description: 'Simplified bulk data structure',
    type: BulkIngestDto,
  })
  @ApiOkResponse({
    description: 'Bulk data ingested successfully',
    type: IngestionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid data or missing required fields',
  })
  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  async bulkIngest(
    @Body() body: BulkIngestDto,
  ) {
    try {
      this.logger.log('Received bulk ingestion request');
      const result = await this.ingestionService.bulkIngest(body);
      this.logger.log(
        `Successfully bulk ingested data for ${result.patients.length} patient(s)`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error bulk ingesting data: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

