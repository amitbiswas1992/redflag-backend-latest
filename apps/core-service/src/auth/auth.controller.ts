import { Public } from '@app/common';
import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RefreshTokenErrorDto, RefreshTokenResponseDto } from './dto/auth.dto';

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) { }

  /**
   * GET /auth/token
   * Authenticate Backend System using JWT
   * Returns access token expiration time
   */
  @ApiOperation({
    summary: 'Authenticate Backend System',
    description:
      'Authenticates a Backend System using JWT Backend Service flow. Token is stored globally and automatically used for subsequent API calls.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Authentication failed',
    type: RefreshTokenErrorDto,
  })
  @Get('token')
  async getToken(): Promise<{
    success: boolean;
    expiresAt: string;
    error?: string;
  }> {
    try {
      const tokens = await this.authService.authenticate();
      return {
        success: true,
        expiresAt: new Date(tokens.expiresAt).toISOString(),
      };
    } catch (err) {
      this.logger.error(`Token error: ${err.message}`, err.stack);
      return {
        success: false,
        expiresAt: '',
        error: err.message,
      };
    }
  }

  /**
   * GET /auth/refresh
   * Re-authenticate to get a new access token
   */
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Re-authenticates using JWT to get a new access token. Token is automatically refreshed when expired during API calls.',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Token refresh failed',
    type: RefreshTokenErrorDto,
  })
  @Get('refresh')
  async refresh(): Promise<{
    success: boolean;
    expiresAt: string;
    error?: string;
  }> {
    try {
      // Re-authenticate using JWT
      const tokens = await this.authService.authenticate();
      return {
        success: true,
        expiresAt: new Date(tokens.expiresAt).toISOString(),
      };
    } catch (err) {
      this.logger.error(`Refresh error: ${err.message}`, err.stack);
      return {
        success: false,
        expiresAt: '',
        error: err.message,
      };
    }
  }
}
