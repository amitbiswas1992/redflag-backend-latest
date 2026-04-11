import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

/**
 * Thrown when external service integrations fail (DB, Keycloak, FHIR APIs).
 * Hides internal error details from clients — logs full stack internally.
 *
 * Example:
 *   throw new InfrastructureException('DB_001', 'Could not save patient record', error);
 */
export class InfrastructureException extends DomainException {
    public readonly originalError?: unknown;

    constructor(
        code: string,
        message: string,
        originalError?: unknown,
        context?: Record<string, unknown>,
    ) {
        super(code, message, HttpStatus.INTERNAL_SERVER_ERROR, context);
        this.originalError = originalError;
    }
}
