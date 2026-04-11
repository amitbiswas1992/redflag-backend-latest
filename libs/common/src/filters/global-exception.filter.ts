import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';
import { DomainException } from '../exceptions/domain.exception';
import { InfrastructureException } from '../exceptions/infrastructure.exception';

/**
 * Global exception filter — registered in main.ts.
 * Catches ALL exceptions (HTTP, Domain, unknown) and:
 *  1. Normalizes the JSON response shape
 *  2. Routes to LoggerService for structured logging
 *  3. Attaches correlation ID for distributed tracing
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    constructor(private readonly logger: LoggerService) { }

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const request = ctx.getRequest<Request>();
        const response = ctx.getResponse<Response>();

        const correlationId =
            (request.headers['x-correlation-id'] as string) ??
            `req_${Date.now().toString(36)}`;

        let statusCode: number;
        let code: string;
        let message: string;
        let logPayload: Record<string, unknown>;

        if (exception instanceof DomainException) {
            statusCode = exception.getStatus();
            const body = exception.getResponse() as any;
            code = body.code ?? 'DOMAIN_ERROR';
            message = body.message ?? 'An error occurred';

            logPayload = {
                code,
                path: request.url,
                method: request.method,
                statusCode,
                correlationId,
                context: exception.context,
                // For infrastructure exceptions, also log the original error
                ...(exception instanceof InfrastructureException
                    ? { originalError: String(exception.originalError) }
                    : {}),
            };

            if (statusCode >= 500) {
                this.logger.error(`[${code}] ${message}`, logPayload);
            } else {
                this.logger.warn(`[${code}] ${message}`, logPayload);
            }
        } else if (exception instanceof HttpException) {
            statusCode = exception.getStatus();
            const body = exception.getResponse();
            message = typeof body === 'string' ? body : (body as any).message ?? 'HTTP error';
            code = `HTTP_${statusCode}`;

            logPayload = {
                code,
                path: request.url,
                method: request.method,
                statusCode,
                correlationId,
            };
            this.logger.warn(`[${code}] ${message}`, logPayload);
        } else {
            // Truly unexpected errors — log full stack
            statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            code = 'INTERNAL_ERROR';
            message = 'An unexpected error occurred. Please try again later.';

            logPayload = {
                code,
                path: request.url,
                method: request.method,
                statusCode,
                correlationId,
                stack: exception instanceof Error ? exception.stack : String(exception),
            };
            this.logger.error(`[${code}] Unhandled exception`, logPayload);
        }

        response.status(statusCode).json({
            success: false,
            code,
            message,
            statusCode,
            timestamp: new Date().toISOString(),
            path: request.url,
            correlationId,
        });
    }
}
