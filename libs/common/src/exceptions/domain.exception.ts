import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base class for all application-level typed exceptions.
 * Carry structured metadata: error code, HTTP status, and optional context.
 * Services should THROW these instead of raw Error or console.error().
 */
export class DomainException extends HttpException {
    constructor(
        public readonly code: string,
        message: string,
        status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
        public readonly context?: Record<string, unknown>,
    ) {
        super({ success: false, code, message }, status);
    }
}
