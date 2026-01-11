import { Injectable, Logger } from '@nestjs/common';
import { TokenData } from './interfaces/token.interface';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private globalToken: TokenData | null = null;

  /**
   * Store global access token (for Backend Systems)
   */
  storeToken(tokenData: TokenData): void {
    this.globalToken = tokenData;
    this.logger.log('Global access token stored');
  }

  /**
   * Get global access token
   */
  getToken(): TokenData | null {
    if (!this.globalToken) {
      return null;
    }

    // Check if token is expired
    if (Date.now() >= this.globalToken.expiresAt) {
      this.logger.warn('Access token expired');
      return this.globalToken; // Return anyway, caller should refresh
    }

    return this.globalToken;
  }

  /**
   * Update global access token (used for refresh)
   */
  updateToken(tokenData: Partial<TokenData>): void {
    if (!this.globalToken) {
      throw new Error('No token to update');
    }

    this.globalToken = {
      ...this.globalToken,
      ...tokenData,
    };

    this.logger.log('Global access token updated');
  }

  /**
   * Clear global access token
   */
  clearToken(): void {
    this.globalToken = null;
    this.logger.log('Global access token cleared');
  }

  /**
   * Check if token exists and is valid
   */
  hasValidToken(): boolean {
    const token = this.getToken();
    return token !== null && Date.now() < token.expiresAt;
  }
}
