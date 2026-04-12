import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
    CORRELATION_ID_HEADER_KEY,
    LEGACY_ORGANIZATION_HEADER_KEY,
    REQUEST_ORGANIZATION_ID_KEY,
    TENANT_HEADER_KEY,
} from '../constants/auth.constants';
import { LoggerService } from '../logger/logger.service';

/**
 * Global logging interceptor — registered in main.ts.
 * Wraps every request lifecycle:
 *  - Logs incoming requests (method, path, tenant)
 *  - Records response time on success
 *  - Re-throws errors so GlobalExceptionFilter handles formatting
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    constructor(private readonly logger: LoggerService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest<Request>();
        const { method, url } = request;
        const organizationId =
            this.readHeader(request, TENANT_HEADER_KEY) ??
            this.readHeader(request, LEGACY_ORGANIZATION_HEADER_KEY) ??
            (request[REQUEST_ORGANIZATION_ID_KEY] as string | undefined) ??
            'anonymous';
        const correlationId =
            this.readHeader(request, CORRELATION_ID_HEADER_KEY) ??
            `req_${Date.now().toString(36)}`;
        const startTime = Date.now();

        this.logger.log(`→ ${method} ${url}`, {
            correlationId,
            organizationId,
        });

        return next.handle().pipe(
            tap(() => {
                const duration = Date.now() - startTime;
                this.logger.log(`← ${method} ${url} [${duration}ms]`, {
                    correlationId,
                    duration,
                });
            }),
            catchError((error) => {
                // Re-throw — GlobalExceptionFilter handles the response format
                // This interceptor only adds extra request-level context logging here if needed
                return throwError(() => error);
            }),
        );
    }

    private readHeader(request: Request, headerKey: string): string | undefined {
        const headerValue = request.headers[headerKey];
        if (Array.isArray(headerValue)) {
            return headerValue[0];
        }
        return headerValue;
    }
}
