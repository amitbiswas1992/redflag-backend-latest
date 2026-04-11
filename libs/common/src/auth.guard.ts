import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwksRsa = require('jwks-rsa');
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';

/**
 * Verifies an incoming Keycloak token using the OIDC JWKS discovery endpoint.
 * This guard is used ONLY on the `/auth/sync` endpoint — it converts a Keycloak
 * token into our internal JWT. All other routes use InternalAuthGuard.
 *
 * Validates: signature, issuer, algorithm, and expiry.
 */
@Injectable()
export class KeycloakAuthGuard implements CanActivate {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly jwksClient: any;
    private readonly issuer: string;

    constructor() {
        const keycloakUrl = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
        const realm = process.env.KEYCLOAK_REALM ?? 'redflag-saas';
        this.issuer = `${keycloakUrl}/realms/${realm}`;

        this.jwksClient = jwksRsa({
            jwksUri: `${this.issuer}/protocol/openid-connect/certs`,
            cache: true,
            cacheMaxAge: 60 * 60 * 1000, // Cache JWKS for 1 hour
            rateLimit: true,
        });
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractToken(request);

        if (!token) {
            throw new UnauthorizedException('KC_MISSING_TOKEN');
        }

        try {
            const decoded = jwt.decode(token, { complete: true });
            if (!decoded || !decoded.header.kid) {
                throw new UnauthorizedException('KC_INVALID_TOKEN_STRUCTURE');
            }

            const signingKey = await this.jwksClient.getSigningKey(decoded.header.kid);
            const publicKey = signingKey.getPublicKey();

            const payload = jwt.verify(token, publicKey, {
                issuer: this.issuer,
                algorithms: ['RS256'],
            }) as any;

            // Attach verified Keycloak payload to request for the sync endpoint
            request['keycloakUser'] = {
                sub: payload.sub,
                email: payload.email,
                firstName: payload.given_name,
                lastName: payload.family_name,
                preferredUsername: payload.preferred_username,
                realmRoles: payload.realm_access?.roles ?? [],
            };

            return true;
        } catch (err: any) {
            throw new UnauthorizedException(`KC_TOKEN_INVALID: ${err.message}`);
        }
    }

    private extractToken(request: Request): string | undefined {
        // Support token from Authorization header OR from request body
        const [type, headerToken] = request.headers.authorization?.split(' ') ?? [];
        if (type === 'Bearer' && headerToken) return headerToken;

        // /auth/sync passes token in body
        return (request.body as any)?.access_token;
    }
}
