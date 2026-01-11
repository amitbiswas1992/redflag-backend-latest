import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { AuthService } from './auth/auth.service';
import { JWKSet } from './auth/utils/jwk.util';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly authService: AuthService,
  ) {}

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

  @ApiOperation({
    summary: 'Get JWK Set',
    description:
      'Returns the JSON Web Key Set (JWK Set) containing the public key for JWT signature verification. This URL should be configured in Epic App Orchard as the Non-Production JWK Set URL.',
  })
  @ApiOkResponse({
    description: 'JWK Set returned successfully',
    schema: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kty: { type: 'string', example: 'RSA' },
              use: { type: 'string', example: 'sig' },
              alg: { type: 'string', example: 'RS256' },
              kid: { type: 'string', example: 'your-key-id' },
              n: { type: 'string', description: 'Modulus (base64url encoded)' },
              e: { type: 'string', description: 'Exponent (base64url encoded)' },
            },
          },
        },
      },
    },
  })
  @Get('.well-known/jwks.json')
  async getJWKSet(): Promise<JWKSet> {
    return await this.authService.getJWKSet();
  }
}
