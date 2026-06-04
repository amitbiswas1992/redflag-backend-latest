import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@AllowAnonymous()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @ApiOperation({
    summary: 'Welcome message',
    description: 'Returns a welcome message',
  })
  @ApiOkResponse({
    description: 'Welcome message',
    schema: {
      type: 'string',
      example: 'Hello World!',
    },
  })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @ApiOperation({
    summary: 'Health check',
    description: 'Returns the health status of the service',
  })
  @ApiOkResponse({
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          example: 'ok',
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-05T10:30:00.000Z',
        },
      },
    },
  })
  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
