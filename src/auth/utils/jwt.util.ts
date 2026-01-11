import * as jwt from 'jsonwebtoken';

export interface JwtConfig {
  privateKey: string;
  keyId: string;
  issuer: string;
  subject: string;
  audience: string;
}

/**
 * Generate JWT for Epic Backend Systems authentication
 * Epic requires JWT signed with RS256 algorithm
 */
export function generateEpicJWT(config: JwtConfig): string {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 300; // 5 minutes (Epic's typical requirement)

  const payload = {
    iss: config.issuer, // Client ID
    sub: config.subject, // Client ID
    aud: config.audience, // FHIR Base URL
    jti: `${config.issuer}-${now}`, // Unique token ID
    exp: now + expiresIn, // Expiration time
    iat: now, // Issued at
  };

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: config.keyId, // Key ID from Epic App Orchard
  };

  try {
    const token = jwt.sign(payload, config.privateKey, {
      algorithm: 'RS256',
      header: header,
    });

    return token;
  } catch (error) {
    throw new Error(`Failed to generate JWT: ${error.message}`);
  }
}

/**
 * Validate JWT configuration
 */
export function validateJwtConfig(config: JwtConfig): void {
  if (!config.privateKey) {
    throw new Error('JWT private key is required');
  }
  if (!config.keyId) {
    throw new Error('JWT Key ID (KID) is required');
  }
  if (!config.issuer) {
    throw new Error('JWT issuer (Client ID) is required');
  }
  if (!config.subject) {
    throw new Error('JWT subject (Client ID) is required');
  }
  if (!config.audience) {
    throw new Error('JWT audience (FHIR Base URL) is required');
  }
}
