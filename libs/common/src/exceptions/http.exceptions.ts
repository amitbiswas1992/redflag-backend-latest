import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

/**
 * Thrown when user-supplied data fails validation.
 * Maps cleanly to 400 Bad Request with field-level detail.
 *
 * Example:
 *   throw new ValidationException('VAL_001', 'Email is required');
 */
export class ValidationException extends DomainException {
    constructor(
        code: string,
        message: string,
        context?: Record<string, unknown>,
    ) {
        super(code, message, HttpStatus.BAD_REQUEST, context);
    }
}

/**
 * Thrown when a requested resource is not found.
 * Maps to 404 Not Found.
 *
 * Example:
 *   throw new NotFoundException('NOT_FOUND_001', 'Patient not found');
 */
export class NotFoundException extends DomainException {
    constructor(
        code: string,
        message: string,
        context?: Record<string, unknown>,
    ) {
        super(code, message, HttpStatus.NOT_FOUND, context);
    }
}

/**
 * Thrown when an operation is not permitted for the current user.
 * Maps to 403 Forbidden.
 *
 * Example:
 *   throw new ForbiddenException('AUTH_002', 'Insufficient permissions');
 */
export class ForbiddenException extends DomainException {
    constructor(
        code: string,
        message: string,
        context?: Record<string, unknown>,
    ) {
        super(code, message, HttpStatus.FORBIDDEN, context);
    }
}

/**
 * Thrown when authentication credentials are missing or invalid.
 * Maps to 401 Unauthorized.
 *
 * Example:
 *   throw new AuthException('AUTH_001', 'Invalid or expired token');
 */
export class AuthException extends DomainException {
    constructor(
        code: string,
        message: string,
        context?: Record<string, unknown>,
    ) {
        super(code, message, HttpStatus.UNAUTHORIZED, context);
    }
}

/**
 * Thrown when a resource conflict occurs (e.g. duplicate email).
 * Maps to 409 Conflict.
 *
 * Example:
 *   throw new ConflictException('USER_001', 'User already exists');
 */
export class ConflictException extends DomainException {
    constructor(
        code: string,
        message: string,
        context?: Record<string, unknown>,
    ) {
        super(code, message, HttpStatus.CONFLICT, context);
    }
}
