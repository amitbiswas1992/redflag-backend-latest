import { registerAs } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

// Epic FHIR Developer Sandbox URLs
const EPIC_SANDBOX_FHIR_BASE_URL =
  'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4';
const EPIC_SANDBOX_TOKEN_URL =
  'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token';

/**
 * Load JWT private key from file or environment variable
 * Priority: EPIC_JWT_PRIVATE_KEY_PATH > EPIC_JWT_PRIVATE_KEY
 */
function loadJwtPrivateKey(): string {
  const keyPath = process.env.EPIC_JWT_PRIVATE_KEY_PATH;
  const keyValue = process.env.EPIC_JWT_PRIVATE_KEY || '';

  // If file path is provided, read from file
  if (keyPath) {
    try {
      // Resolve path (supports relative and absolute paths)
      const resolvedPath = path.isAbsolute(keyPath)
        ? keyPath
        : path.resolve(process.cwd(), keyPath);

      if (!fs.existsSync(resolvedPath)) {
        throw new Error(
          `JWT private key file not found: ${resolvedPath}`,
        );
      }

      const keyContent = fs.readFileSync(resolvedPath, 'utf8').trim();
      if (!keyContent) {
        throw new Error(
          `JWT private key file is empty: ${resolvedPath}`,
        );
      }

      return keyContent;
    } catch (error) {
      throw new Error(
        `Failed to read JWT private key from file: ${error.message}`,
      );
    }
  }

  // Otherwise, use the value from environment variable
  return keyValue;
}

export default registerAs('epic', () => {
  const useSandbox = process.env.EPIC_USE_SANDBOX === 'true';

  // Use sandbox URLs if EPIC_USE_SANDBOX=true, otherwise use custom URLs
  const fhirBaseUrl =
    useSandbox && !process.env.EPIC_FHIR_BASE_URL
      ? EPIC_SANDBOX_FHIR_BASE_URL
      : process.env.EPIC_FHIR_BASE_URL || '';

  const tokenUrl =
    useSandbox && !process.env.EPIC_TOKEN_URL
      ? EPIC_SANDBOX_TOKEN_URL
      : process.env.EPIC_TOKEN_URL || '';

  return {
    clientId: process.env.EPIC_CLIENT_ID || '',
    fhirBaseUrl,
    tokenUrl,
    scope:
      process.env.EPIC_SCOPE ||
      'system/Patient.read system/Observation.read system/Condition.read',
    useSandbox,
    // JWT Backend Service configuration
    jwtPrivateKey: loadJwtPrivateKey(),
    jwtKeyId: process.env.EPIC_JWT_KEY_ID || '',
    jwtIssuer: process.env.EPIC_JWT_ISSUER || process.env.EPIC_CLIENT_ID || '',
    jwtSubject:
      process.env.EPIC_JWT_SUBJECT || process.env.EPIC_CLIENT_ID || '',
    jwtAudience: process.env.EPIC_JWT_AUDIENCE || fhirBaseUrl || '',
  };
});
