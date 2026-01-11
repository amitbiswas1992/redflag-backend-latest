import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { TokenService } from '../token/token.service';
import { generateEpicJWT, validateJwtConfig } from './utils/jwt.util';
import { createJWKSet } from './utils/jwk.util';
import { JWKSet } from './utils/jwk.util';
import { TokenData } from '../token/interfaces/token.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly httpClient: AxiosInstance;
  private epicConfig: {
    clientId: string;
    fhirBaseUrl: string;
    tokenUrl: string;
    scope: string;
    jwtPrivateKey: string;
    jwtKeyId: string;
    jwtIssuer: string;
    jwtSubject: string;
    jwtAudience: string;
  };

  constructor(
    private configService: ConfigService,
    private tokenService: TokenService,
  ) {
    const config = this.configService.get('epic');
    if (!config) {
      throw new Error('Epic configuration is missing');
    }

    // Validate JWT configuration (required for Backend Systems)
    try {
      validateJwtConfig({
        privateKey: config.jwtPrivateKey,
        keyId: config.jwtKeyId,
        issuer: config.jwtIssuer,
        subject: config.jwtSubject,
        audience: config.jwtAudience,
      });
    } catch (error) {
      this.logger.error(
        `JWT configuration validation failed: ${error.message}`,
      );
      throw new Error(
        `Invalid JWT configuration: ${error.message}`,
      );
    }

    this.epicConfig = {
      clientId: config.clientId,
      fhirBaseUrl: config.fhirBaseUrl,
      tokenUrl: config.tokenUrl,
      scope: config.scope,
      jwtPrivateKey: config.jwtPrivateKey,
      jwtKeyId: config.jwtKeyId,
      jwtIssuer: config.jwtIssuer,
      jwtSubject: config.jwtSubject,
      jwtAudience: config.jwtAudience,
    };

    this.httpClient = axios.create({
      timeout: 30000,
    });
  }

  /**
   * Authenticate using JWT Backend Service
   * Gets a new access token and stores it globally
   */
  async authenticate(): Promise<TokenData> {
    try {
      // Generate JWT
      const jwt = generateEpicJWT({
        privateKey: this.epicConfig.jwtPrivateKey,
        keyId: this.epicConfig.jwtKeyId,
        issuer: this.epicConfig.jwtIssuer,
        subject: this.epicConfig.jwtSubject,
        audience: this.epicConfig.jwtAudience,
      });

      // Request access token using JWT
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_assertion_type:
          'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: jwt,
        scope: this.epicConfig.scope,
      });

      const response = await this.httpClient.post(
        this.epicConfig.tokenUrl,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const tokenData: TokenData = {
        accessToken: response.data.access_token,
        refreshToken: '', // Backend Systems typically don't use refresh tokens
        expiresIn: response.data.expires_in || 3600,
        tokenType: response.data.token_type || 'Bearer',
        scope: response.data.scope || this.epicConfig.scope,
        patientId: undefined, // Backend Systems don't have patient context
        expiresAt: Date.now() + (response.data.expires_in || 3600) * 1000,
      };

      // Store token globally
      this.tokenService.storeToken(tokenData);

      this.logger.log('Backend System authenticated successfully');
      return tokenData;
    } catch (error) {
      this.logger.error(
        `Backend System authentication failed: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to authenticate Backend System: ${error.message}`,
      );
    }
  }

  /**
   * Get access token (automatically authenticates if needed)
   */
  async getAccessToken(): Promise<string> {
    let token = this.tokenService.getToken();

    // If no token or expired, authenticate
    if (!token || Date.now() >= token.expiresAt) {
      this.logger.log('No valid token found, authenticating...');
      token = await this.authenticate();
    }

    return token.accessToken;
  }

  /**
   * Get JWK Set for public key distribution
   * This endpoint serves the public key in JWK format for Epic to verify JWT signatures
   */
  async getJWKSet(): Promise<JWKSet> {
    try {
      return createJWKSet(
        this.epicConfig.jwtPrivateKey,
        this.epicConfig.jwtKeyId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create JWK Set: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to get JWK Set: ${error.message}`,
      );
    }
  }
}
