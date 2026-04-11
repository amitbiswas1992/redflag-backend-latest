import * as crypto from 'crypto';

export interface JWK {
  kty: string;
  use: string;
  alg: string;
  kid: string;
  n: string;
  e: string;
}

export interface JWKSet {
  keys: JWK[];
}

/**
 * Convert PEM public key to JWK format
 * @param publicKeyPem - PEM formatted public key
 * @param keyId - Key ID (kid) to use in JWK
 * @returns JWK object
 */
export function pemToJWK(publicKeyPem: string, keyId: string): JWK {
  try {
    // Remove PEM headers and whitespace
    const cleanKey = publicKeyPem
      .replace(/-----BEGIN PUBLIC KEY-----/g, '')
      .replace(/-----END PUBLIC KEY-----/g, '')
      .replace(/-----BEGIN RSA PUBLIC KEY-----/g, '')
      .replace(/-----END RSA PUBLIC KEY-----/g, '')
      .replace(/\s/g, '');

    // Create public key object from PEM
    const publicKey = crypto.createPublicKey({
      key: publicKeyPem,
      format: 'pem',
    });

    // Export key in DER format
    const derKey = publicKey.export({ format: 'der', type: 'spki' });

    // Parse ASN.1 DER to extract modulus (n) and exponent (e)
    // This is a simplified approach - for production, consider using a library like 'jose' or 'node-jose'
    const keyObject = crypto.createPublicKey(publicKeyPem);
    const keyDetails = keyObject.asymmetricKeyDetails;

    // Extract modulus and exponent using Node.js crypto
    // Note: Node.js doesn't directly export n and e, so we need to use a workaround
    // We'll use the public key to verify and extract components
    const jwk = keyObject.export({ format: 'jwk' });

    if (!jwk.n || !jwk.e) {
      throw new Error('Failed to extract modulus and exponent from public key');
    }

    return {
      kty: 'RSA',
      use: 'sig',
      alg: 'RS256',
      kid: keyId,
      n: jwk.n,
      e: jwk.e,
    };
  } catch (error) {
    throw new Error(`Failed to convert PEM to JWK: ${error.message}`);
  }
}

/**
 * Extract public key from private key PEM
 * @param privateKeyPem - PEM formatted private key
 * @returns PEM formatted public key
 */
export function extractPublicKeyFromPrivate(privateKeyPem: string): string {
  try {
    const privateKey = crypto.createPrivateKey({
      key: privateKeyPem,
      format: 'pem',
    });

    const publicKey = crypto.createPublicKey(privateKey);
    return publicKey.export({ format: 'pem', type: 'spki' }) as string;
  } catch (error) {
    throw new Error(
      `Failed to extract public key from private key: ${error.message}`,
    );
  }
}

/**
 * Create JWK Set from private key PEM
 * @param privateKeyPem - PEM formatted private key
 * @param keyId - Key ID (kid) to use in JWK
 * @returns JWK Set object
 */
export function createJWKSet(
  privateKeyPem: string,
  keyId: string,
): JWKSet {
  try {
    const publicKeyPem = extractPublicKeyFromPrivate(privateKeyPem);
    const jwk = pemToJWK(publicKeyPem, keyId);
    return {
      keys: [jwk],
    };
  } catch (error) {
    throw new Error(`Failed to create JWK Set: ${error.message}`);
  }
}

